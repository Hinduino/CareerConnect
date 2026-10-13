const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Set up mandatory environment variables before importing the app
process.env.JWT_SECRET = 'test_secret_key_12345';
process.env.MONGO_URI = 'mongodb://localhost:27017/'; // Will be overridden

// Mock the authentication middleware so we can easily test protected routes
jest.mock('../src/middleware/auth', () => {
    return (req, res, next) => {
        if (req.headers.test_user_id) {
            req.user = { id: req.headers.test_user_id };
            return next();
        }
        return res.status(401).json({ error: 'Unauthorized' });
    };
});

const app = require('../src/server');
const User = require('../src/models/User');
const JobPosting = require('../src/models/JobPosting');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany();
    }
});

function sampleJob(overrides = {}) {
    return {
        title: 'Software Engineer',
        company: 'Acme Corp',
        location: 'Remote',
        category: 'Engineering',
        description: 'Build great things.',
        requirements: '3+ years experience',
        ...overrides
    };
}

describe('Job posting routes', () => {
    let recruiterId;
    let otherRecruiterId;
    let jobSeekerId;

    beforeEach(async () => {
        const recruiter = await User.create({
            email: 'recruiter@example.com',
            password: 'password123',
            role: 'recruiter'
        });
        recruiterId = recruiter._id.toString();

        const otherRecruiter = await User.create({
            email: 'other-recruiter@example.com',
            password: 'password123',
            role: 'recruiter'
        });
        otherRecruiterId = otherRecruiter._id.toString();

        const jobSeeker = await User.create({
            email: 'seeker@example.com',
            password: 'password123',
            role: 'job_seeker'
        });
        jobSeekerId = jobSeeker._id.toString();
    });

    describe('POST /api/jobs', () => {
        it('allows a recruiter to create a job posting', async () => {
            const res = await request(app)
                .post('/api/jobs')
                .set('test_user_id', recruiterId)
                .send(sampleJob());

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('title', 'Software Engineer');
            expect(res.body).toHaveProperty('postedBy', recruiterId);
            expect(res.body).toHaveProperty('createdAt');
        });

        it('rejects job creation from a job seeker', async () => {
            const res = await request(app)
                .post('/api/jobs')
                .set('test_user_id', jobSeekerId)
                .send(sampleJob());

            expect(res.status).toBe(403);
        });

        it('rejects job creation with missing fields', async () => {
            const res = await request(app)
                .post('/api/jobs')
                .set('test_user_id', recruiterId)
                .send(sampleJob({ title: '' }));

            expect(res.status).toBe(400);
        });

        it('rejects unauthenticated job creation', async () => {
            const res = await request(app)
                .post('/api/jobs')
                .send(sampleJob());

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/jobs/mine', () => {
        it('returns only the postings created by the logged-in recruiter', async () => {
            await JobPosting.create({ ...sampleJob(), postedBy: recruiterId });
            await JobPosting.create({ ...sampleJob({ title: 'Other job' }), postedBy: otherRecruiterId });

            const res = await request(app)
                .get('/api/jobs/mine')
                .set('test_user_id', recruiterId);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('title', 'Software Engineer');
        });
    });

    describe('PUT /api/jobs/:id', () => {
        it('allows the owning recruiter to modify their posting', async () => {
            const job = await JobPosting.create({ ...sampleJob(), postedBy: recruiterId });

            const res = await request(app)
                .put(`/api/jobs/${job._id}`)
                .set('test_user_id', recruiterId)
                .send(sampleJob({ title: 'Senior Software Engineer' }));

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('title', 'Senior Software Engineer');
        });

        it('forbids another recruiter from modifying someone else\'s posting', async () => {
            const job = await JobPosting.create({ ...sampleJob(), postedBy: recruiterId });

            const res = await request(app)
                .put(`/api/jobs/${job._id}`)
                .set('test_user_id', otherRecruiterId)
                .send(sampleJob({ title: 'Hijacked title' }));

            expect(res.status).toBe(403);
        });

        it('returns 404 when the job does not exist', async () => {
            const missingId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/api/jobs/${missingId}`)
                .set('test_user_id', recruiterId)
                .send(sampleJob());

            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/jobs', () => {
        it('lists postings created by recruiters for job seekers to browse', async () => {
            await JobPosting.create({ ...sampleJob(), postedBy: recruiterId });

            const res = await request(app).get('/api/jobs');

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('postedBy');
        });
    });
});
