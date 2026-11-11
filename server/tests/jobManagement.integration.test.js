// SCRUM-278: Integration tests for SCRUM-106, PR #52
// (SCRUM-310 recruiter posting management: applicant counts and archiving).
//
// Tests written with `it.failing` document known bugs found during testing.
// They pass while the bug exists and start failing once it is fixed, as a
// reminder to turn them into normal `it` tests.

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
const JobPosting = require('../src/models/JobPosting');
const Resume = require('../src/models/Resume');
const Application = require('../src/models/Application');

let mongoServer;

const MISSING_ID = '507f1f77bcf86cd799439099';

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
        title: 'Frontend Developer',
        company: 'Acme Corp',
        location: 'Remote',
        category: 'Engineering',
        description: 'Build user interfaces.',
        requirements: '2+ years of React',
        postedBy,
        ...overrides,
    });
    return job._id.toString();
}

async function createResume(userId) {
    const resume = await Resume.create({
        user: userId,
        originalName: 'resume.pdf',
        contentType: 'application/pdf',
        size: 4,
        data: Buffer.from('test'),
    });
    return resume._id.toString();
}

async function createApplication(applicantId, jobId, status = 'Applied') {
    await Application.create({ applicant: applicantId, job: jobId, status });
}

function toggleArchive(jobId, userId) {
    const req = request(app).patch(`/api/jobs/${jobId}/archive`);
    if (userId) req.set('test_user_id', userId);
    return req.send();
}

function getMine(userId, path = '/api/jobs/mine') {
    return request(app).get(path).set('test_user_id', userId);
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

// ==========================================================================
// SCRUM-310: Recruiter's postings with applicant counts
// ==========================================================================
describe('GET /api/jobs/mine (recruiter postings with applicant counts)', () => {
    it('includes how many applications each posting has received', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const busyJobId = await createJob(recruiterId, { title: 'Frontend Developer' });
        await createJob(recruiterId, { title: 'Data Analyst' });
        for (let i = 0; i < 3; i += 1) {
            await createApplication(await createUser(), busyJobId);
        }

        const response = await getMine(recruiterId);

        expect(response.status).toBe(200);
        const counts = Object.fromEntries(response.body.map((job) => [job.title, job.applicantCount]));
        expect(counts).toEqual({ 'Frontend Developer': 3, 'Data Analyst': 0 });
    });

    it('counts applications of every status, including declined offers', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const jobId = await createJob(recruiterId);
        for (const status of ['Applied', 'Interview', 'Rejected', 'Offer Declined']) {
            await createApplication(await createUser(), jobId, status);
        }

        const response = await getMine(recruiterId);

        expect(response.body[0].applicantCount).toBe(4);
    });

    it("does not count applications to another recruiter's postings", async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const otherRecruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId, { title: 'Mine' });
        const otherJobId = await createJob(otherRecruiterId, { title: 'Theirs' });
        await createApplication(await createUser(), otherJobId);

        const response = await getMine(recruiterId);

        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toEqual(expect.objectContaining({ title: 'Mine', applicantCount: 0 }));
    });

    it('marks new postings as active (not archived)', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });

        const created = await request(app)
            .post('/api/jobs')
            .set('test_user_id', recruiterId)
            .send({
                title: 'QA Tester',
                company: 'Acme Corp',
                location: 'Remote',
                category: 'Engineering',
                description: 'Test things.',
                requirements: 'Attention to detail',
            });
        const response = await getMine(recruiterId);

        expect(created.status).toBe(201);
        expect(created.body.isArchived).toBe(false);
        expect(response.body[0].isArchived).toBe(false);
    });

    it('serves the same data on the /recruiter/my-postings alias', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const jobId = await createJob(recruiterId);
        await createApplication(await createUser(), jobId);

        const mine = await getMine(recruiterId);
        const alias = await getMine(recruiterId, '/api/jobs/recruiter/my-postings');

        expect(alias.status).toBe(200);
        expect(alias.body).toEqual(mine.body);
    });

    it('is not available to job seekers (403)', async () => {
        const seekerId = await createUser();

        const response = await getMine(seekerId);

        expect(response.status).toBe(403);
    });
});

// ==========================================================================
// SCRUM-310: Archiving postings
// ==========================================================================
describe('PATCH /api/jobs/:id/archive (archive / unarchive a posting)', () => {
    it('archives an active posting, then unarchives it on the next call', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const jobId = await createJob(recruiterId);

        const archive = await toggleArchive(jobId, recruiterId);
        expect(archive.status).toBe(200);
        expect(archive.body.message).toBe('Job posting archived successfully');
        expect(archive.body.job.isArchived).toBe(true);
        expect((await JobPosting.findById(jobId)).isArchived).toBe(true);

        const unarchive = await toggleArchive(jobId, recruiterId);
        expect(unarchive.status).toBe(200);
        expect(unarchive.body.message).toBe('Job posting unarchived successfully');
        expect((await JobPosting.findById(jobId)).isArchived).toBe(false);
    });

    it('keeps the archived posting and its applications visible to the recruiter', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const jobId = await createJob(recruiterId);
        await createApplication(await createUser(), jobId);

        await toggleArchive(jobId, recruiterId);
        const mine = await getMine(recruiterId);
        const applicants = await request(app)
            .get(`/api/applications/jobs/${jobId}`)
            .set('test_user_id', recruiterId);

        expect(mine.body[0]).toEqual(expect.objectContaining({ isArchived: true, applicantCount: 1 }));
        expect(applicants.body).toHaveLength(1);
    });

    it("does not let a recruiter archive another recruiter's posting (403)", async () => {
        const ownerId = await createUser({ role: 'recruiter' });
        const otherRecruiterId = await createUser({ role: 'recruiter' });
        const jobId = await createJob(ownerId);

        const response = await toggleArchive(jobId, otherRecruiterId);

        expect(response.status).toBe(403);
        expect((await JobPosting.findById(jobId)).isArchived).toBe(false);
    });

    it('does not let a job seeker archive a posting (403)', async () => {
        const ownerId = await createUser({ role: 'recruiter' });
        const seekerId = await createUser();
        const jobId = await createJob(ownerId);

        const response = await toggleArchive(jobId, seekerId);

        expect(response.status).toBe(403);
        expect((await JobPosting.findById(jobId)).isArchived).toBe(false);
    });

    it('requires authentication (401)', async () => {
        const ownerId = await createUser({ role: 'recruiter' });
        const jobId = await createJob(ownerId);

        const response = await toggleArchive(jobId, null);

        expect(response.status).toBe(401);
    });

    it('returns 404 for a posting that does not exist', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });

        const response = await toggleArchive(MISSING_ID, recruiterId);

        expect(response.status).toBe(404);
    });

    it('returns 400 for a malformed job id', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });

        const response = await toggleArchive('not-an-id', recruiterId);

        expect(response.status).toBe(400);
    });

    // Known bug: PR #52 says archived postings are hidden from applicant
    // search, but GET /api/jobs does not filter on isArchived.
    it('hides archived postings from the public job list', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId, { title: 'Still Open' });
        const archivedJobId = await createJob(recruiterId, { title: 'Closed Role' });
        await toggleArchive(archivedJobId, recruiterId);

        const response = await request(app).get('/api/jobs');

        expect(response.body.map((job) => job.title)).toEqual(['Still Open']);
    });
});

// ==========================================================================
// SCRUM-310: Applying to archived postings
// ==========================================================================
describe('POST /api/applications (archived postings)', () => {
    async function seekerWithResume() {
        const seekerId = await createUser();
        const resumeId = await createResume(seekerId);
        return { seekerId, resumeId };
    }

    function apply(seekerId, jobId, resumeId) {
        return request(app)
            .post('/api/applications')
            .set('test_user_id', seekerId)
            .send({ jobId, resumeId });
    }

    it('refuses new applications to an archived posting', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const jobId = await createJob(recruiterId);
        const { seekerId, resumeId } = await seekerWithResume();
        await toggleArchive(jobId, recruiterId);

        const response = await apply(seekerId, jobId, resumeId);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('This job posting is archived and no longer accepts applications.');
        expect(await Application.countDocuments({ job: jobId })).toBe(0);
    });

    it('accepts applications again once the posting is unarchived', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const jobId = await createJob(recruiterId);
        const { seekerId, resumeId } = await seekerWithResume();
        await toggleArchive(jobId, recruiterId);
        await toggleArchive(jobId, recruiterId);

        const response = await apply(seekerId, jobId, resumeId);

        expect(response.status).toBe(201);
    });

    it('returns 404 when applying to a posting that does not exist', async () => {
        const { seekerId, resumeId } = await seekerWithResume();

        const response = await apply(seekerId, MISSING_ID, resumeId);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Job posting not found.');
    });

    it('keeps existing applications when a posting is archived', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const jobId = await createJob(recruiterId);
        const { seekerId, resumeId } = await seekerWithResume();
        await apply(seekerId, jobId, resumeId);

        await toggleArchive(jobId, recruiterId);
        const history = await request(app).get('/api/applications/history').set('test_user_id', seekerId);

        expect(history.body).toHaveLength(1);
        expect(history.body[0].job.title).toBe('Frontend Developer');
    });
});