// Builds the MongoDB filter for the public job list (Find Jobs).
//
// SCRUM-365: only postings that are still open are listed (not archived and
// not past their due date), and the keyword is matched against the title,
// company, description and requirements. Every value typed by the user is
// escaped before it reaches a regular expression, so characters such as "("
// or ".*" are searched for literally instead of breaking the query, and each
// value is cast with String() so it can never act as a MongoDB operator.

const MAX_SEARCH_LENGTH = 100;
const KEYWORD_FIELDS = ['title', 'company', 'description', 'requirements'];

// Escapes every character that has a special meaning in a regular expression.
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Turns raw query-string input into a trimmed, length-limited string, or ''
// when nothing usable was given (arrays and objects from ?a[]=x are ignored).
function cleanSearchValue(value) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, MAX_SEARCH_LENGTH);
}

// Case-insensitive "contains" pattern for user-supplied text.
function containsPattern(value) {
    return { $regex: escapeRegex(value), $options: 'i' };
}

function buildJobSearchQuery({ keyword, location, category } = {}, now = new Date()) {
    const cleanKeyword = cleanSearchValue(keyword);
    const cleanLocation = cleanSearchValue(location);
    const cleanCategory = cleanSearchValue(category);

    const conditions = [
        { isArchived: { $ne: true } },
        // Open postings: no due date, or a due date that hasn't passed yet.
        { $or: [{ dueDate: null }, { dueDate: { $gte: now } }] },
    ];

    if (cleanKeyword) {
        conditions.push({
            $or: KEYWORD_FIELDS.map((field) => ({ [field]: containsPattern(String(cleanKeyword)) })),
        });
    }

    if (cleanLocation) {
        conditions.push({ location: containsPattern(String(cleanLocation)) });
    }

    if (cleanCategory) {
        // Whole-value match that ignores capitalization ("engineering" finds
        // "Engineering" but not "Software Engineering").
        conditions.push({
            category: { $regex: `^${escapeRegex(String(cleanCategory))}$`, $options: 'i' },
        });
    }

    return { $and: conditions };
}

module.exports = {
    MAX_SEARCH_LENGTH,
    KEYWORD_FIELDS,
    escapeRegex,
    cleanSearchValue,
    buildJobSearchQuery,
};