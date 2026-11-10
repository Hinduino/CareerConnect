// SCRUM-278: Integration tests for SCRUM-106 (Application Status Tracking,
// Analytics, History Dashboard, and Recruiter Posting Management).
//
// Covers:
//   - PR #50 (SCRUM-315/316/317): recruiter status updates and the
//     recruiter's per-job applicant list.
//   - PR #50 (SCRUM-277) and PR #51 (SCRUM-309): the job seeker's
//     /my and /history views, and declining an offer.
//
// Tests written with `it.failing` document known bugs found during manual
// testing (SCRUM-290). They pass while the bug exists, and start failing
// once it is fixed, as a reminder to turn them into normal `it` tests.

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

// Creates an application directly in the database, so each test can start
// from any status without going through the submission flow.
async function createApplication(applicantId, jobId, overrides = {}) {
    const application = await Application.create({
        applicant: applicantId,
        job: jobId,
        status: 'Applied',
        resume: {
            originalName: 'resume.pdf',
            contentType: 'application/pdf',
            size: 4,
            data: Buffer.from('test'),
        },
        ...overrides,
    });
    return application._id.toString();
}

// A recruiter with one posting and one application on it.
async function setupScenario({ status = 'Applied' } = {}) {
    const recruiterId = await createUser({ role: 'recruiter' });
    const applicantId = await createUser();
    const jobId = await createJob(recruiterId);
    const applicationId = await createApplication(applicantId, jobId, { status });
    return { recruiterId, applicantId, jobId, applicationId };
}

function updateStatus(applicationId, userId, status) {
    const req = request(app).patch(`/api/applications/${applicationId}/status`);
    if (userId) req.set('test_user_id', userId);
    return req.send({ status });
}

function declineOffer(applicationId, userId) {
    const req = request(app).patch(`/api/applications/${applicationId}/decline-offer`);
    if (userId) req.set('test_user_id', userId);
    return req.send();
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
// PR #50 – SCRUM-315: Recruiter application status management
// ==========================================================================
describe('PATCH /api/applications/:applicationId/status (recruiter status updates)', () => {
    it.each(['Under Review', 'Interview', 'Offered', 'Rejected', 'Applied'])(
        'lets the owning recruiter set the status to "%s" and saves it',
        async (status) => {
            const { recruiterId, applicationId } = await setupScenario({
                status: status === 'Applied' ? 'Interview' : 'Applied',
            });

            const response = await updateStatus(applicationId, recruiterId, status);

            expect(response.status).toBe(200);
            expect(response.body.application.status).toBe(status);

            const stored = await Application.findById(applicationId);
            expect(stored.status).toBe(status);
        }
    );

    it('makes the new status visible to the applicant in /my and /history', async () => {
        const { recruiterId, applicantId, applicationId } = await setupScenario();

        await updateStatus(applicationId, recruiterId, 'Interview');

        const my = await request(app).get('/api/applications/my').set('test_user_id', applicantId);
        const history = await request(app).get('/api/applications/history').set('test_user_id', applicantId);

        expect(my.body[0].status).toBe('Interview');
        expect(history.body[0].status).toBe('Interview');
    });

    it.each([
        ['an unknown status', 'Hired'],
        ['a lowercase variant', 'interview'],
        ['an empty string', ''],
        ['a missing status', undefined],
    ])('rejects %s with 400 and leaves the status unchanged', async (_label, status) => {
        const { recruiterId, applicationId } = await setupScenario();

        const response = await updateStatus(applicationId, recruiterId, status);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid application status.');
        expect((await Application.findById(applicationId)).status).toBe('Applied');
    });

    it('requires authentication (401)', async () => {
        const { applicationId } = await setupScenario();

        const response = await updateStatus(applicationId, null, 'Interview');

        expect(response.status).toBe(401);
    });

    it('does not let a job seeker change a status, even on their own application (403)', async () => {
        const { applicantId, applicationId } = await setupScenario();

        const response = await updateStatus(applicationId, applicantId, 'Offered');

        expect(response.status).toBe(403);
        expect((await Application.findById(applicationId)).status).toBe('Applied');
    });

    it("does not let a recruiter change another recruiter's application (403)", async () => {
        const { applicationId } = await setupScenario();
        const otherRecruiterId = await createUser({ role: 'recruiter' });

        const response = await updateStatus(applicationId, otherRecruiterId, 'Rejected');

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Not authorized to update this application.');
        expect((await Application.findById(applicationId)).status).toBe('Applied');
    });

    it('returns 404 for an application that does not exist', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });

        const response = await updateStatus(MISSING_ID, recruiterId, 'Interview');

        expect(response.status).toBe(404);
    });

    it('returns 400 for a malformed application id', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });

        const response = await updateStatus('not-an-id', recruiterId, 'Interview');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid application ID');
    });

    // Known bug: "Offer Declined" is meant to be set only by the candidate
    // (PR #51), but the recruiter's list of allowed statuses includes it.
    it.failing('KNOWN BUG: does not let a recruiter set "Offer Declined" (only the candidate can)', async () => {
        const { recruiterId, applicationId } = await setupScenario({ status: 'Offered' });

        const response = await updateStatus(applicationId, recruiterId, 'Offer Declined');

        expect(response.status).toBe(400);
    });
});

// ==========================================================================
// PR #50 – SCRUM-316: Recruiter applicant list per posting
// ==========================================================================
describe('GET /api/applications/jobs/:jobId (recruiter applicant list)', () => {
    it("returns the applications for the recruiter's own posting with applicant details", async () => {
        const { recruiterId, jobId } = await setupScenario();

        const response = await request(app)
            .get(`/api/applications/jobs/${jobId}`)
            .set('test_user_id', recruiterId);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].applicant).toEqual(
            expect.objectContaining({ name: 'Test User', email: expect.any(String) })
        );
        expect(response.body[0].status).toBe('Applied');
    });

    it("only returns that posting's applications, not the recruiter's other postings", async () => {
        const { recruiterId, applicantId, jobId } = await setupScenario();
        const otherJobId = await createJob(recruiterId, { title: 'Data Analyst' });
        await createApplication(applicantId, otherJobId);

        const response = await request(app)
            .get(`/api/applications/jobs/${jobId}`)
            .set('test_user_id', recruiterId);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].job.toString()).toBe(jobId);
    });

    it("does not let a recruiter view another recruiter's applicants (403)", async () => {
        const { jobId } = await setupScenario();
        const otherRecruiterId = await createUser({ role: 'recruiter' });

        const response = await request(app)
            .get(`/api/applications/jobs/${jobId}`)
            .set('test_user_id', otherRecruiterId);

        expect(response.status).toBe(403);
    });

    it('does not let a job seeker view the applicant list (403)', async () => {
        const { applicantId, jobId } = await setupScenario();

        const response = await request(app)
            .get(`/api/applications/jobs/${jobId}`)
            .set('test_user_id', applicantId);

        expect(response.status).toBe(403);
    });

    it('returns 404 for a posting that does not exist', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });

        const response = await request(app)
            .get(`/api/applications/jobs/${MISSING_ID}`)
            .set('test_user_id', recruiterId);

        expect(response.status).toBe(404);
    });
});

// ==========================================================================
// PR #50 – SCRUM-277 and PR #51 – SCRUM-309: Job seeker views
// ==========================================================================
describe('GET /api/applications/my and /history (job seeker views)', () => {
    async function seekerWithTwoApplications() {
        const recruiterId = await createUser({ role: 'recruiter' });
        const applicantId = await createUser();
        const otherApplicantId = await createUser();
        const olderJobId = await createJob(recruiterId, { title: 'Data Analyst', company: 'Globex' });
        const newerJobId = await createJob(recruiterId, { title: 'Frontend Developer' });

        await createApplication(applicantId, olderJobId, { createdAt: new Date('2026-11-01') });
        await createApplication(applicantId, newerJobId, {
            status: 'Interview',
            createdAt: new Date('2026-11-05'),
        });
        await createApplication(otherApplicantId, olderJobId);

        return { recruiterId, applicantId };
    }

    it.each(['/my', '/history'])(
        '%s returns only the logged-in seeker’s applications, newest first, with job details',
        async (path) => {
            const { applicantId } = await seekerWithTwoApplications();

            const response = await request(app)
                .get(`/api/applications${path}`)
                .set('test_user_id', applicantId);

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);
            expect(response.body.map((a) => a.job.title)).toEqual(['Frontend Developer', 'Data Analyst']);
            expect(response.body.map((a) => a.status)).toEqual(['Interview', 'Applied']);
            expect(response.body[1].job.company).toBe('Globex');
        }
    );

    it('/my does not send the resume file back to the browser', async () => {
        const { applicantId } = await seekerWithTwoApplications();

        const response = await request(app).get('/api/applications/my').set('test_user_id', applicantId);

        expect(response.body[0]).not.toHaveProperty('resume');
    });

    it.each(['/my', '/history'])('%s returns an empty list for a seeker with no applications', async (path) => {
        const applicantId = await createUser();

        const response = await request(app)
            .get(`/api/applications${path}`)
            .set('test_user_id', applicantId);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it.each(['/my', '/history'])('%s is not available to recruiters (403)', async (path) => {
        const recruiterId = await createUser({ role: 'recruiter' });

        const response = await request(app)
            .get(`/api/applications${path}`)
            .set('test_user_id', recruiterId);

        expect(response.status).toBe(403);
    });

    it.each(['/my', '/history'])('%s requires authentication (401)', async (path) => {
        const response = await request(app).get(`/api/applications${path}`);

        expect(response.status).toBe(401);
    });
});

// ==========================================================================
// PR #51 – SCRUM-309: Candidate declines an offer
// ==========================================================================
describe('PATCH /api/applications/:id/decline-offer (candidate declines an offer)', () => {
    it('changes an Offered application to "Offer Declined" and records when', async () => {
        const { applicantId, applicationId } = await setupScenario({ status: 'Offered' });

        const response = await declineOffer(applicationId, applicantId);

        expect(response.status).toBe(200);
        expect(response.body.application.status).toBe('Offer Declined');

        const stored = await Application.findById(applicationId);
        expect(stored.status).toBe('Offer Declined');
        expect(stored.declinedAt).toBeInstanceOf(Date);
    });

    it.each(['Applied', 'Under Review', 'Interview', 'Rejected', 'Offer Declined'])(
        'refuses to decline when the status is "%s" (no offer to decline)',
        async (status) => {
            const { applicantId, applicationId } = await setupScenario({ status });

            const response = await declineOffer(applicationId, applicantId);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Cannot decline an offer unless one has been extended.');
            expect((await Application.findById(applicationId)).status).toBe(status);
        }
    );

    it("does not let a seeker decline someone else's offer", async () => {
        const { applicationId } = await setupScenario({ status: 'Offered' });
        const otherApplicantId = await createUser();

        const response = await declineOffer(applicationId, otherApplicantId);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Application not found.');
        expect((await Application.findById(applicationId)).status).toBe('Offered');
    });

    it('does not let a recruiter decline on the candidate’s behalf (403)', async () => {
        const { recruiterId, applicationId } = await setupScenario({ status: 'Offered' });

        const response = await declineOffer(applicationId, recruiterId);

        expect(response.status).toBe(403);
        expect((await Application.findById(applicationId)).status).toBe('Offered');
    });

    it('requires authentication (401)', async () => {
        const { applicationId } = await setupScenario({ status: 'Offered' });

        const response = await declineOffer(applicationId, null);

        expect(response.status).toBe(401);
    });

    it('shows the declined offer in the seeker’s history', async () => {
        const { applicantId, applicationId } = await setupScenario({ status: 'Offered' });

        await declineOffer(applicationId, applicantId);
        const history = await request(app).get('/api/applications/history').set('test_user_id', applicantId);

        expect(history.body[0].status).toBe('Offer Declined');
        expect(history.body[0].declinedAt).toBeTruthy();
    });
});

// ==========================================================================
// Full flow across PR #50 and PR #51
// ==========================================================================
describe('End-to-end status flow', () => {
    it('Applied → Under Review → Interview → Offered → candidate declines', async () => {
        const { recruiterId, applicantId, applicationId } = await setupScenario();

        for (const status of ['Under Review', 'Interview', 'Offered']) {
            const response = await updateStatus(applicationId, recruiterId, status);
            expect(response.status).toBe(200);
        }

        const decline = await declineOffer(applicationId, applicantId);
        expect(decline.status).toBe(200);

        const my = await request(app).get('/api/applications/my').set('test_user_id', applicantId);
        expect(my.body[0].status).toBe('Offer Declined');
    });
});

// ==========================================================================
// Known bug: role check on submission
// ==========================================================================
describe('POST /api/applications (role check)', () => {
    // Known bug: the submit route has requireAuth but no requireRole, so a
    // recruiter account can apply to jobs.
    it.failing('KNOWN BUG: does not let a recruiter submit an application (403)', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const otherRecruiterId = await createUser({ role: 'recruiter' });
        const jobId = await createJob(otherRecruiterId);

        const response = await request(app)
            .post('/api/applications')
            .set('test_user_id', recruiterId)
            .send({ jobId, resumeId: MISSING_ID });

        expect(response.status).toBe(403);
    });
});