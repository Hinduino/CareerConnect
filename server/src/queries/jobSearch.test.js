// SCRUM-366: Unit tests for the Find Jobs search filter (SCRUM-365).

const {
    MAX_SEARCH_LENGTH,
    KEYWORD_FIELDS,
    escapeRegex,
    cleanSearchValue,
    buildJobSearchQuery,
} = require('./jobSearch');

const NOW = new Date('2026-11-26T12:00:00.000Z');

// The extra conditions added after "not archived" and "not expired"
function searchConditions(filters) {
    return buildJobSearchQuery(filters, NOW).$and.slice(2);
}

describe('escapeRegex', () => {
    it.each([
        ['(', '\\('],
        ['.*', '\\.\\*'],
        ['C++', 'C\\+\\+'],
        ['a|b', 'a\\|b'],
        ['[x]', '\\[x\\]'],
        ['$100^', '\\$100\\^'],
        ['back\\slash', 'back\\\\slash'],
        ['{2}?', '\\{2\\}\\?'],
    ])('escapes %p', (input, expected) => {
        expect(escapeRegex(input)).toBe(expected);
    });

    it('leaves ordinary text unchanged', () => {
        expect(escapeRegex('Frontend Developer')).toBe('Frontend Developer');
    });

    it('produces a pattern that matches the text literally', () => {
        const pattern = new RegExp(escapeRegex('C++ (Senior)'), 'i');
        expect(pattern.test('Looking for a c++ (senior) dev')).toBe(true);
        expect(pattern.test('Looking for a C dev')).toBe(false);
    });
});

describe('cleanSearchValue', () => {
    it('trims surrounding spaces', () => {
        expect(cleanSearchValue('  React  ')).toBe('React');
    });

    it(`limits the value to ${MAX_SEARCH_LENGTH} characters`, () => {
        expect(cleanSearchValue('a'.repeat(500))).toHaveLength(MAX_SEARCH_LENGTH);
    });

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['a number', 42],
        ['an array (?keyword[]=x)', ['x']],
        ['an object (?keyword[$ne]=x)', { $ne: 'x' }],
        ['only spaces', '   '],
    ])('returns an empty string for %s', (_label, value) => {
        expect(cleanSearchValue(value)).toBe('');
    });
});

describe('buildJobSearchQuery', () => {
    it('always hides archived postings and postings past their due date', () => {
        const query = buildJobSearchQuery({}, NOW);

        expect(query.$and).toEqual([
            { isArchived: { $ne: true } },
            { $or: [{ dueDate: null }, { dueDate: { $gte: NOW } }] },
        ]);
    });

    it('uses the current time when none is given', () => {
        const before = Date.now();
        const query = buildJobSearchQuery();
        const usedTime = query.$and[1].$or[1].dueDate.$gte.getTime();

        expect(usedTime).toBeGreaterThanOrEqual(before);
        expect(usedTime).toBeLessThanOrEqual(Date.now());
    });

    it('adds no search conditions when the filters are empty', () => {
        expect(searchConditions({ keyword: '', location: '  ', category: '' })).toEqual([]);
    });

    it('matches the keyword against the title, company, description and requirements', () => {
        const [keywordCondition] = searchConditions({ keyword: 'react' });

        expect(KEYWORD_FIELDS).toEqual(['title', 'company', 'description', 'requirements']);
        expect(keywordCondition).toEqual({
            $or: KEYWORD_FIELDS.map((field) => ({ [field]: { $regex: 'react', $options: 'i' } })),
        });
    });

    it('matches part of the location, ignoring capitalization', () => {
        expect(searchConditions({ location: 'montreal' })).toEqual([
            { location: { $regex: 'montreal', $options: 'i' } },
        ]);
    });

    it('matches the whole category, ignoring capitalization', () => {
        expect(searchConditions({ category: 'engineering' })).toEqual([
            { category: { $regex: '^engineering$', $options: 'i' } },
        ]);
    });

    it('combines keyword, location and category', () => {
        const conditions = searchConditions({ keyword: 'react', location: 'Remote', category: 'Engineering' });

        expect(conditions).toHaveLength(3);
        expect(conditions[1]).toEqual({ location: { $regex: 'Remote', $options: 'i' } });
        expect(conditions[2]).toEqual({ category: { $regex: '^Engineering$', $options: 'i' } });
    });

    it('escapes special characters in every filter', () => {
        const conditions = searchConditions({ keyword: 'C++', location: '(Remote)', category: 'R&D.*' });

        expect(conditions[0].$or[0].title.$regex).toBe('C\\+\\+');
        expect(conditions[1].location.$regex).toBe('\\(Remote\\)');
        expect(conditions[2].category.$regex).toBe('^R&D\\.\\*$');
    });

    it('ignores filters that are not plain text, so they cannot act as query operators', () => {
        expect(searchConditions({ keyword: { $ne: '' }, location: ['x'], category: { $gt: '' } })).toEqual([]);
    });
});