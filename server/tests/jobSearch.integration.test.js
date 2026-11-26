// SCRUM-366: Integration tests for Find Jobs search and listings (SCRUM-365),
// using GET /api/jobs against an in-memory MongoDB.

const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'test_secret_key_12345';
process.env.MONGO_URI = 'mongodb://localhost:27017/';

const app = require('../src/server');
const User = require('../src/models/User');
const JobPosting = require('../src/models/JobPosting');

const DAY = 24 * 60 * 60 * 1000;
let mongoServer;
let recruiterId;

async function createJob(overrides = {}) {
    return JobPosting.create({
        title: 'Frontend Developer',
        company: 'Acme Corp',
        location: 'Montreal, QC',
        category: 'Engineering',
        description: 'Build user interfaces.',
        requirements: 'HTML and CSS',
        postedBy: recruiterId,
        ...overrides,
    });
}

async function search(query = {}) {
    const response = await request(app).get('/api/jobs').query(query);
    return { status: response.status, titles: response.body.map((job) => job.title).sort() };
}

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.disconnect();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    for (const collection of Object.values(mongoose.connection.collections)) {
        await collection.deleteMany();
    }
    const recruiter = await User.create({
        email: `recruiter${Math.random()}@example.com`,
        password: 'password123',
        role: 'recruiter',
    });
    recruiterId = recruiter._id;
});

describe('GET /api/jobs: which postings are listed', () => {
    it('lists open postings with and without a due date, newest first', async () => {
        await createJob({ title: 'No deadline', createdAt: new Date(Date.now() - 2 * DAY) });
        await createJob({ title: 'Closing next week', dueDate: new Date(Date.now() + 7 * DAY) });

        const response = await request(app).get('/api/jobs');

        expect(response.status).toBe(200);
        expect(response.body.map((job) => job.title)).toEqual(['Closing next week', 'No deadline']);
    });

    it('hides postings whose due date has passed', async () => {
        await createJob({ title: 'Open role' });
        await createJob({ title: 'Expired yesterday', dueDate: new Date(Date.now() - DAY) });

        expect((await search()).titles).toEqual(['Open role']);
    });

    it('hides archived postings, even when their due date has not passed', async () => {
        await createJob({ title: 'Open role' });
        await createJob({ title: 'Archived role', isArchived: true, dueDate: new Date(Date.now() + DAY) });

        expect((await search()).titles).toEqual(['Open role']);
    });

    it('also hides expired postings from search results', async () => {
        await createJob({ title: 'React Developer' });
        await createJob({ title: 'React Lead', dueDate: new Date(Date.now() - DAY) });

        expect((await search({ keyword: 'react' })).titles).toEqual(['React Developer']);
    });

    it('returns an empty list when there are no open postings', async () => {
        await createJob({ title: 'Expired', dueDate: new Date(Date.now() - DAY) });

        const response = await request(app).get('/api/jobs');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it('includes the due date in each listing', async () => {
        const dueDate = new Date(Date.now() + 3 * DAY);
        await createJob({ dueDate });

        const response = await request(app).get('/api/jobs');

        expect(new Date(response.body[0].dueDate).getTime()).toBe(dueDate.getTime());
    });
});

describe('GET /api/jobs: keyword search', () => {
    beforeEach(async () => {
        await createJob({ title: 'React Developer' });
        await createJob({ title: 'Data Analyst', company: 'Reactor Labs' });
        await createJob({ title: 'Backend Developer', description: 'Build APIs with Node.js and React SSR.' });
        await createJob({ title: 'QA Tester', requirements: 'Experience testing React apps' });
        await createJob({ title: 'Designer', company: 'Studio', description: 'Figma work', requirements: 'Portfolio' });
    });

    it('finds the keyword in the title, company, description or requirements', async () => {
        expect((await search({ keyword: 'react' })).titles).toEqual([
            'Backend Developer',
            'Data Analyst',
            'QA Tester',
            'React Developer',
        ]);
    });

    it('ignores capitalization', async () => {
        expect((await search({ keyword: 'FIGMA' })).titles).toEqual(['Designer']);
    });

    it('ignores spaces around the keyword', async () => {
        expect((await search({ keyword: '  figma  ' })).titles).toEqual(['Designer']);
    });

    it('returns every open posting for an empty keyword', async () => {
        expect((await search({ keyword: '' })).titles).toHaveLength(5);
    });

    it('returns an empty list when nothing matches', async () => {
        const result = await search({ keyword: 'zzzz' });

        expect(result.status).toBe(200);
        expect(result.titles).toEqual([]);
    });
});

describe('GET /api/jobs: special characters', () => {
    beforeEach(async () => {
        await createJob({ title: 'C++ Developer' });
        await createJob({ title: 'C Developer' });
        await createJob({ title: 'Engineer (Remote)' });
    });

    it('searches for special characters literally', async () => {
        expect((await search({ keyword: 'C++' })).titles).toEqual(['C++ Developer']);
        expect((await search({ keyword: '(Remote)' })).titles).toEqual(['Engineer (Remote)']);
    });

    it.each(['(', '[', '*', '.*', '\\', '?', '$', '^', '|'])(
        'does not fail or match everything for %p',
        async (keyword) => {
            const result = await search({ keyword });

            expect(result.status).toBe(200);
            expect(result.titles.length).toBeLessThan(3);
        }
    );

    it('ignores query operators sent instead of text', async () => {
        const response = await request(app).get('/api/jobs?keyword[$ne]=x&category[$gt]=');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(3);
    });
});

describe('GET /api/jobs: location and category filters', () => {
    beforeEach(async () => {
        await createJob({ title: 'Montreal Engineer', location: 'Montreal, QC', category: 'Engineering' });
        await createJob({ title: 'Toronto Engineer', location: 'Toronto, ON', category: 'Engineering' });
        await createJob({ title: 'Montreal Designer', location: 'Montreal, QC', category: 'Design' });
        await createJob({ title: 'Software Role', location: 'Remote', category: 'Software Engineering' });
    });

    it('filters by part of the location, ignoring capitalization', async () => {
        expect((await search({ location: 'montreal' })).titles).toEqual(['Montreal Designer', 'Montreal Engineer']);
    });

    it('filters by the whole category, ignoring capitalization', async () => {
        expect((await search({ category: 'engineering' })).titles).toEqual(['Montreal Engineer', 'Toronto Engineer']);
    });

    it('finds postings with a custom category', async () => {
        expect((await search({ category: 'Software Engineering' })).titles).toEqual(['Software Role']);
    });

    it('combines keyword, location and category', async () => {
        expect((await search({ keyword: 'engineer', location: 'Montreal', category: 'Engineering' })).titles).toEqual([
            'Montreal Engineer',
        ]);
    });

    it('returns an empty list when the filters exclude everything', async () => {
        expect((await search({ location: 'Vancouver', category: 'Engineering' })).titles).toEqual([]);
    });
});