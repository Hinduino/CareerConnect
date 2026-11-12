const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'test_secret_key_12345';
process.env.MONGO_URI = 'mongodb://localhost:27017/';

jest.mock('../src/middleware/auth', () => (req, res, next) => {
    if (!req.headers.test_user_id) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: req.headers.test_user_id };
    next();
});

const app = require('../src/server');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
const JobPosting = require('../src/models/JobPosting');
const Resume = require('../src/models/Resume');

let mongoServer;

async function createUser(overrides = {}) {
    const user = await User.create({
        email: `user${Math.random()}@example.com`,
        password: 'password123',
        name: 'Test User',
        role: 'job_seeker',
        ...overrides,
    });
    return user._id.toString();
}

async function createJob(postedBy, overrides = {}) {
    const job = await JobPosting.create({
        title: 'Software Engineer',
        company: 'Acme Corp',
        location: 'Remote',
        category: 'Engineering',
        description: 'Build great things.',
        requirements: '3+ years experience',
        postedBy,
        ...overrides,
    });
    return job._id.toString();
}

async function createResume(userId, overrides = {}) {
    const resume = await Resume.create({
        user: userId,
        originalName: 'resume.pdf',
        contentType: 'application/pdf',
        size: 4,
        data: Buffer.from('test'),
        ...overrides,
    });
    return resume._id.toString();
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
});

describe('Error handling in routes', () => {
    it('handles database errors when fetching application history', async () => {
        const applicantId = await createUser();

        jest.spyOn(Application, 'find').mockImplementationOnce(() => {
            throw new Error('Database connection failed');
        });

        const response = await request(app)
            .get('/api/applications/history')
            .set('test_user_id', applicantId);

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('application history');

        Application.find.mockRestore();
    });

    it('handles errors when fetching jobs for recruiter fails', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });

        jest.spyOn(JobPosting, 'aggregate').mockImplementationOnce(() => {
            throw new Error('Aggregation pipeline error');
        });

        const response = await request(app)
            .get('/api/jobs/mine')
            .set('test_user_id', recruiterId);

        expect(response.status).toBe(500);

        JobPosting.aggregate.mockRestore();
    });

    it('handles errors in my applications endpoint', async () => {
        const applicantId = await createUser();

        jest.spyOn(Application, 'find').mockImplementationOnce(() => {
            throw new Error('Query failed');
        });

        const response = await request(app)
            .get('/api/applications/my')
            .set('test_user_id', applicantId);

        expect(response.status).toBe(500);

        Application.find.mockRestore();
    });
});
