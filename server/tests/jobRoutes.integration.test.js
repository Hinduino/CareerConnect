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
    // DELETE /api/jobs/:id - Test recruiter job posting deletion.
    describe('DELETE /api/jobs/:id', () => {

        // Verify that a recruiter can delete their own posting.
        it('allows the owning recruiter to delete their posting', async () => {
            const job = await JobPosting.create({ ...sampleJob(), postedBy: recruiterId });

            const res = await request(app)
                .delete(`/api/jobs/${job._id}`)
                .set('test_user_id', recruiterId);

            expect(res.status).toBe(200);
            expect(await JobPosting.findById(job._id)).toBeNull();
        });

        // Verify that recruiters cannot delete postings owned by others.
        it('prevents another recruiter from deleting the posting', async () => {
            const job = await JobPosting.create({ ...sampleJob(), postedBy: recruiterId });

            const res = await request(app)
                .delete(`/api/jobs/${job._id}`)
                .set('test_user_id', otherRecruiterId);

            expect(res.status).toBe(403);
            expect(await JobPosting.findById(job._id)).not.toBeNull();
        });

        // Verify that users must be authenticated to delete postings.
        it('rejects unauthenticated deletion', async () => {
            const job = await JobPosting.create({ ...sampleJob(), postedBy: recruiterId });

            const res = await request(app).delete(`/api/jobs/${job._id}`);

            expect(res.status).toBe(401);
        });

        // Verify that deleting a nonexistent posting returns 404.
        it('returns 404 for a nonexistent posting', async () => {
            const missingId = new mongoose.Types.ObjectId();

            const res = await request(app)
                .delete(`/api/jobs/${missingId}`)
                .set('test_user_id', recruiterId);

            expect(res.status).toBe(404);
        });
        it('returns 400 for an invalid job ID', async () => {
            const res = await request(app)
                .delete('/api/jobs/invalid-id')
                .set('test_user_id', recruiterId);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid job ID');
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
        it('returns 400 for an invalid job ID', async () => {
            const res = await request(app)
                .put('/api/jobs/invalid-id')
                .set('test_user_id', recruiterId)
                .send(sampleJob());

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid job ID');
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
    describe('GET /api/jobs/:id', () => {
        it('returns 400 for an invalid job ID', async () => {
            const res = await request(app)
                .get('/api/jobs/invalid-id');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid job ID');
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
    describe('GET /api/applications/jobs/:jobId', () => {
    it('allows a recruiter to view applications for their own posting', async () => {
        const job = await JobPosting.create({
            ...sampleJob(),
            postedBy: recruiterId
        });

        await Application.create({
            applicant: jobSeekerId,
            job: job._id
        });

        const res = await request(app)
            .get(`/api/applications/jobs/${job._id}`)
            .set('test_user_id', recruiterId);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].status).toBe('Applied');
        expect(res.body[0].applicant.email).toBe('seeker@example.com');
        expect(res.body[0].applicant).not.toHaveProperty('password');
        });
    });
    it('returns applications in first-come, first-served order', async () => {
    const job = await JobPosting.create({
        ...sampleJob(),
        postedBy: recruiterId
    });

    const applicants = await User.create([
        { email: 'first@example.com', password: 'password123', role: 'job_seeker' },
        { email: 'second@example.com', password: 'password123', role: 'job_seeker' },
        { email: 'third@example.com', password: 'password123', role: 'job_seeker' }
    ]);

    const dates = [
        new Date('2026-10-14T09:00:00Z'),
        new Date('2026-10-14T09:10:00Z'),
        new Date('2026-10-14T09:20:00Z')
    ];

    const applications = await Application.create(
        applicants.map((applicant, index) => ({
            applicant: applicant._id,
            job: job._id,
            createdAt: dates[index]
        })).reverse()
    );

    const res = await request(app)
        .get(`/api/applications/jobs/${job._id}`)
        .set('test_user_id', recruiterId);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.map(application => application._id)).toEqual(
        [...applications].reverse().map(application => application._id.toString())
    );
});
    it('prevents another recruiter from viewing applications', async () => {
    const job = await JobPosting.create({
        ...sampleJob(),
        postedBy: recruiterId
    });

    await Application.create({
        applicant: jobSeekerId,
        job: job._id
    });

    const res = await request(app)
        .get(`/api/applications/jobs/${job._id}`)
        .set('test_user_id', otherRecruiterId);

    expect(res.status).toBe(403);
    });
    it('rejects unauthenticated access to applications', async () => {
    const job = await JobPosting.create({
        ...sampleJob(),
        postedBy: recruiterId
    });

    const res = await request(app)
        .get(`/api/applications/jobs/${job._id}`);

    expect(res.status).toBe(401);
    });
    it('prevents job seekers from viewing recruiter applications', async () => {
    const job = await JobPosting.create({
        ...sampleJob(),
        postedBy: recruiterId
    });

    const res = await request(app)
        .get(`/api/applications/jobs/${job._id}`)
        .set('test_user_id', jobSeekerId);

    expect(res.status).toBe(403);
    });
});
