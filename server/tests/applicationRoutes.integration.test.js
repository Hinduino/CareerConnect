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
const Application = require('../src/models/Application');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(uri);
    // Build the unique applicant + job index before the duplicate test runs.
    await Application.init();
}, 60000); // Starting the in-memory database can take a while on slower machines.

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

describe('Application status tracking routes', () => {
    let recruiterId;
    let otherRecruiterId;
    let jobSeekerId;
    let otherJobSeekerId;
    let job;

    beforeEach(async () => {
        const recruiter = await User.create({
            email: 'recruiter@example.com', password: 'password123', role: 'recruiter'
        });
        recruiterId = recruiter._id.toString();

        const otherRecruiter = await User.create({
            email: 'other-recruiter@example.com', password: 'password123', role: 'recruiter'
        });
        otherRecruiterId = otherRecruiter._id.toString();

        const jobSeeker = await User.create({
            email: 'seeker@example.com', password: 'password123', role: 'job_seeker'
        });
        jobSeekerId = jobSeeker._id.toString();

        const otherJobSeeker = await User.create({
            email: 'other-seeker@example.com', password: 'password123', role: 'job_seeker'
        });
        otherJobSeekerId = otherJobSeeker._id.toString();

        job = await JobPosting.create({ ...sampleJob(), postedBy: recruiterId });
    });

    describe('POST /api/applications', () => {
        it('lets a job seeker apply and starts the application as Applied', async () => {
            const res = await request(app)
                .post('/api/applications')
                .set('test_user_id', jobSeekerId)
                .send({ jobId: job._id.toString() });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('status', 'Applied');
            expect(res.body.statusHistory).toHaveLength(1);
            expect(res.body.statusHistory[0]).toHaveProperty('status', 'Applied');
            expect(res.body.job).toHaveProperty('title', 'Software Engineer');

            const saved = await Application.findById(res.body._id);
            expect(saved.applicant.toString()).toBe(jobSeekerId);
        });

        it('returns 409 when the job seeker has already applied', async () => {
            await Application.create({ applicant: jobSeekerId, job: job._id });

            const res = await request(app)
                .post('/api/applications')
                .set('test_user_id', jobSeekerId)
                .send({ jobId: job._id.toString() });

            expect(res.status).toBe(409);
            expect(await Application.countDocuments()).toBe(1);
        });

        it('returns 400 for an invalid job ID', async () => {
            const res = await request(app)
                .post('/api/applications')
                .set('test_user_id', jobSeekerId)
                .send({ jobId: 'not-an-id' });

            expect(res.status).toBe(400);
        });

        it('returns 404 when the job does not exist', async () => {
            const res = await request(app)
                .post('/api/applications')
                .set('test_user_id', jobSeekerId)
                .send({ jobId: new mongoose.Types.ObjectId().toString() });

            expect(res.status).toBe(404);
        });

        it('prevents recruiters from applying', async () => {
            const res = await request(app)
                .post('/api/applications')
                .set('test_user_id', recruiterId)
                .send({ jobId: job._id.toString() });

            expect(res.status).toBe(403);
        });

        it('rejects unauthenticated applications', async () => {
            const res = await request(app)
                .post('/api/applications')
                .send({ jobId: job._id.toString() });

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/applications/mine', () => {
        it('returns only the logged-in job seeker\'s applications with job details', async () => {
            await Application.create({ applicant: jobSeekerId, job: job._id });
            await Application.create({ applicant: otherJobSeekerId, job: job._id });

            const res = await request(app)
                .get('/api/applications/mine')
                .set('test_user_id', jobSeekerId);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].applicant).toBe(jobSeekerId);
            expect(res.body[0].job).toHaveProperty('company', 'Acme Corp');
            expect(res.body[0]).toHaveProperty('status', 'Applied');
        });

        it('prevents recruiters from using the job seeker list', async () => {
            const res = await request(app)
                .get('/api/applications/mine')
                .set('test_user_id', recruiterId);

            expect(res.status).toBe(403);
        });
    });

    describe('PATCH /api/applications/:id/status', () => {
        let application;

        beforeEach(async () => {
            application = await Application.create({ applicant: jobSeekerId, job: job._id });
        });

        it('lets the owning recruiter update the status and records it in the history', async () => {
            const res = await request(app)
                .patch(`/api/applications/${application._id}/status`)
                .set('test_user_id', recruiterId)
                .send({ status: 'Under Review' });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('status', 'Under Review');
            expect(res.body.statusHistory.map((entry) => entry.status))
                .toEqual(['Applied', 'Under Review']);

            const saved = await Application.findById(application._id);
            expect(saved.status).toBe('Under Review');
            expect(saved.statusHistory).toHaveLength(2);
        });

        it('shows the updated status to the job seeker', async () => {
            await request(app)
                .patch(`/api/applications/${application._id}/status`)
                .set('test_user_id', recruiterId)
                .send({ status: 'Interview' });

            const res = await request(app)
                .get('/api/applications/mine')
                .set('test_user_id', jobSeekerId);

            expect(res.body[0]).toHaveProperty('status', 'Interview');
        });

        it('rejects a status that is not in the list', async () => {
            const res = await request(app)
                .patch(`/api/applications/${application._id}/status`)
                .set('test_user_id', recruiterId)
                .send({ status: 'Hired' });

            expect(res.status).toBe(400);
        });

        it('rejects setting the status the application already has', async () => {
            const res = await request(app)
                .patch(`/api/applications/${application._id}/status`)
                .set('test_user_id', recruiterId)
                .send({ status: 'Applied' });

            expect(res.status).toBe(400);
            const saved = await Application.findById(application._id);
            expect(saved.statusHistory).toHaveLength(1);
        });

        it('prevents another recruiter from updating the status', async () => {
            const res = await request(app)
                .patch(`/api/applications/${application._id}/status`)
                .set('test_user_id', otherRecruiterId)
                .send({ status: 'Offered' });

            expect(res.status).toBe(403);
        });

        it('prevents job seekers from updating the status', async () => {
            const res = await request(app)
                .patch(`/api/applications/${application._id}/status`)
                .set('test_user_id', jobSeekerId)
                .send({ status: 'Offered' });

            expect(res.status).toBe(403);
        });

        it('returns 404 when the application does not exist', async () => {
            const res = await request(app)
                .patch(`/api/applications/${new mongoose.Types.ObjectId()}/status`)
                .set('test_user_id', recruiterId)
                .send({ status: 'Offered' });

            expect(res.status).toBe(404);
        });

        it('returns 400 for an invalid application ID', async () => {
            const res = await request(app)
                .patch('/api/applications/not-an-id/status')
                .set('test_user_id', recruiterId)
                .send({ status: 'Offered' });

            expect(res.status).toBe(400);
        });
    });
});