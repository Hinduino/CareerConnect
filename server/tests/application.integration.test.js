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

function parseBuffer(response, callback) {
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => callback(null, Buffer.concat(chunks)));
}

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

async function submitApplicationForNotificationTests() {
    const recruiterId = await createUser({ role: 'recruiter' });
    const applicantId = await createUser();
    const jobId = await createJob(recruiterId);
    const resumeId = await createResume(applicantId);
    const response = await request(app)
        .post('/api/applications')
        .set('test_user_id', applicantId)
        .send({ jobId, resumeId });

    return {
        recruiterId,
        applicantId,
        jobId,
        applicationId: response.body.application && response.body.application._id,
        submissionResponse: response,
    };
}

describe('Application submission and management', () => {
    it('requires authentication to submit, check status, cancel, or download', async () => {
        const submit = await request(app).post('/api/applications').send({ jobId: 'x', resumeId: 'y' });
        const status = await request(app).get('/api/applications/status/507f1f77bcf86cd799439011');
        const cancel = await request(app).delete('/api/applications/507f1f77bcf86cd799439011');
        const download = await request(app).get('/api/applications/507f1f77bcf86cd799439011/resume');

        expect(submit.status).toBe(401);
        expect(status.status).toBe(401);
        expect(cancel.status).toBe(401);
        expect(download.status).toBe(401);
    });

    it('requires a resumeId to submit an application', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const applicantId = await createUser();
        const jobId = await createJob(recruiterId);

        const response = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId });

        expect(response.status).toBe(400);
    });

    it('rejects a resume that does not belong to the applicant', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const applicantId = await createUser();
        const someoneElseId = await createUser();
        const jobId = await createJob(recruiterId);
        const resumeId = await createResume(someoneElseId);

        const response = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId, resumeId });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Selected resume could not be found.');
    });

    it('submits an application, attaches the selected resume, and blocks a duplicate submission', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const applicantId = await createUser();
        const jobId = await createJob(recruiterId);
        const resumeId = await createResume(applicantId);

        const submit = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId, resumeId });

        expect(submit.status).toBe(201);
        expect(submit.body.application).not.toHaveProperty('resume');

        const stored = await Application.findOne({ applicant: applicantId, job: jobId }).select('+resume.data');
        expect(stored.resume.originalName).toBe('resume.pdf');
        expect(Buffer.from(stored.resume.data)).toEqual(Buffer.from('test'));

        const duplicate = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId, resumeId });

        expect(duplicate.status).toBe(409);
    });

    it('reports application status before and after applying', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const applicantId = await createUser();
        const jobId = await createJob(recruiterId);
        const resumeId = await createResume(applicantId);

        const before = await request(app)
            .get(`/api/applications/status/${jobId}`)
            .set('test_user_id', applicantId);
        expect(before.body).toEqual({ applied: false, applicationId: null });

        await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId, resumeId });

        const after = await request(app)
            .get(`/api/applications/status/${jobId}`)
            .set('test_user_id', applicantId);
        expect(after.body.applied).toBe(true);
        expect(after.body.applicationId).toBeTruthy();
    });

    it('lets an applicant cancel their own application, removing it and freeing them to reapply', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const applicantId = await createUser();
        const otherApplicantId = await createUser();
        const jobId = await createJob(recruiterId);
        const resumeId = await createResume(applicantId);

        const submit = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId, resumeId });
        const applicationId = submit.body.application._id;

        const deniedCancel = await request(app)
            .delete(`/api/applications/${applicationId}`)
            .set('test_user_id', otherApplicantId);
        expect(deniedCancel.status).toBe(404);

        const cancel = await request(app)
            .delete(`/api/applications/${applicationId}`)
            .set('test_user_id', applicantId);
        expect(cancel.status).toBe(200);
        expect(await Application.findById(applicationId)).toBeNull();

        const reapply = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId, resumeId });
        expect(reapply.status).toBe(201);
    });

    it('removes a cancelled application from the recruiter’s applicant list', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const applicantId = await createUser();
        const jobId = await createJob(recruiterId);
        const resumeId = await createResume(applicantId);

        const submit = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId, resumeId });
        const applicationId = submit.body.application._id;

        const beforeCancel = await request(app)
            .get(`/api/applications/jobs/${jobId}`)
            .set('test_user_id', recruiterId);
        expect(beforeCancel.body).toHaveLength(1);

        await request(app)
            .delete(`/api/applications/${applicationId}`)
            .set('test_user_id', applicantId);

        const afterCancel = await request(app)
            .get(`/api/applications/jobs/${jobId}`)
            .set('test_user_id', recruiterId);
        expect(afterCancel.body).toHaveLength(0);
    });

    it('lets the applicant and the owning recruiter download the attached resume, and no one else', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const otherRecruiterId = await createUser({ role: 'recruiter' });
        const applicantId = await createUser();
        const jobId = await createJob(recruiterId);
        const resumeId = await createResume(applicantId);

        const submit = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId, resumeId });
        const applicationId = submit.body.application._id;

        const applicantDownload = await request(app)
            .get(`/api/applications/${applicationId}/resume`)
            .set('test_user_id', applicantId)
            .buffer(true)
            .parse(parseBuffer);
        expect(applicantDownload.status).toBe(200);
        expect(Buffer.compare(applicantDownload.body, Buffer.from('test'))).toBe(0);

        const recruiterDownload = await request(app)
            .get(`/api/applications/${applicationId}/resume`)
            .set('test_user_id', recruiterId)
            .buffer(true)
            .parse(parseBuffer);
        expect(recruiterDownload.status).toBe(200);

        const otherRecruiterDownload = await request(app)
            .get(`/api/applications/${applicationId}/resume`)
            .set('test_user_id', otherRecruiterId);
        expect(otherRecruiterDownload.status).toBe(403);
    });
});

    it('rejects application submission with invalid job ID', async () => {
        const applicantId = await createUser();
        const resumeId = await createResume(applicantId);

        const response = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId: 'invalid-id', resumeId });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid job ID');
    });

    it('rejects application status check with invalid job ID', async () => {
        const applicantId = await createUser();

        const response = await request(app)
            .get('/api/applications/status/invalid-id')
            .set('test_user_id', applicantId);
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid job ID');
    });

    it('rejects cancellation with invalid application ID', async () => {
        const applicantId = await createUser();

        const response = await request(app)
            .delete('/api/applications/invalid-id')
            .set('test_user_id', applicantId);
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid application ID');
    });

    it('rejects resume download with invalid application ID', async () => {
        const applicantId = await createUser();

        const response = await request(app)
            .get('/api/applications/invalid-id/resume')
            .set('test_user_id', applicantId);
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid application ID');
    });

    it('blocks resume download for unauthorized users', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const applicantId = await createUser();
        const otherUserId = await createUser();
        const jobId = await createJob(recruiterId);
        const resumeId = await createResume(applicantId);

        const response = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId, resumeId });

        const applicationId = response.body.application._id;

        const download = await request(app)
            .get(`/api/applications/${applicationId}/resume`)
            .set('test_user_id', otherUserId);
        
        expect(download.status).toBe(403);
        expect(download.body.error).toBe('You do not have permission to access this resume');
    });

    it('returns 404 when trying to cancel non-existent application', async () => {
        const applicantId = await createUser();
        const fakeId = new mongoose.Types.ObjectId();

        const response = await request(app)
            .delete(`/api/applications/${fakeId}`)
            .set('test_user_id', applicantId);
        
        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Application not found.');
    });

    it('returns 404 when trying to download non-existent application', async () => {
        const applicantId = await createUser();
        const fakeId = new mongoose.Types.ObjectId();

        const response = await request(app)
            .get(`/api/applications/${fakeId}/resume`)
            .set('test_user_id', applicantId);
        
        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Application not found');
    });

    it('allows recruiter to update application status', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const applicantId = await createUser();
        const jobId = await createJob(recruiterId);
        const resumeId = await createResume(applicantId);

        const response = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId, resumeId });

        const applicationId = response.body.application._id;

        const updateResponse = await request(app)
            .patch(`/api/applications/${applicationId}/status`)
            .set('test_user_id', recruiterId)
            .send({ status: 'Under Review' });
        
        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.application.status).toBe('Under Review');
    });

    it('rejects status update with invalid application ID', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });

        const response = await request(app)
            .patch('/api/applications/invalid-id/status')
            .set('test_user_id', recruiterId)
            .send({ status: 'Under Review' });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid application ID');
    });

    it('allows recruiter to view applications for their own posting', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const applicantId = await createUser();
        const jobId = await createJob(recruiterId);
        const resumeId = await createResume(applicantId);

        await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId, resumeId });

        const response = await request(app)
            .get(`/api/applications/jobs/${jobId}`)
            .set('test_user_id', recruiterId);
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].applicant.name).toBe('Test User');
    });

    it('prevents recruiter from viewing applications for other postings', async () => {
        const recruiter1Id = await createUser({ role: 'recruiter' });
        const recruiter2Id = await createUser({ role: 'recruiter' });
        const jobId = await createJob(recruiter1Id);

        const response = await request(app)
            .get(`/api/applications/jobs/${jobId}`)
            .set('test_user_id', recruiter2Id);
        
        expect(response.status).toBe(403);
        expect(response.body.error).toContain('can only view applications for your own');
    });

    it('returns 404 when recruiter requests non-existent job', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const fakeId = new mongoose.Types.ObjectId();

        const response = await request(app)
            .get(`/api/applications/jobs/${fakeId}`)
            .set('test_user_id', recruiterId);
        
        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Job not found');
    });

    it('allows applicant to download their own resume', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const applicantId = await createUser();
        const jobId = await createJob(recruiterId);
        const resumeId = await createResume(applicantId);

        const response = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId, resumeId });

        const applicationId = response.body.application._id;

        const download = await request(app)
            .get(`/api/applications/${applicationId}/resume`)
            .set('test_user_id', applicantId)
            .buffer(true)
            .parse(parseBuffer);
        
        expect(download.status).toBe(200);
        expect(Buffer.compare(download.body, Buffer.from('test'))).toBe(0);
    });

describe('Application notification dashboards', () => {
    it("notifies only the recruiter who owns the posting when an application is submitted", async () => {
        const {
            recruiterId,
            applicantId,
            jobId,
            applicationId,
            submissionResponse,
        } = await submitApplicationForNotificationTests();
        const otherRecruiterId = await createUser({ role: 'recruiter' });

        expect(submissionResponse.status).toBe(201);

        const recruiterDashboard = await request(app)
            .get('/api/notifications')
            .set('test_user_id', recruiterId);
        const otherRecruiterDashboard = await request(app)
            .get('/api/notifications')
            .set('test_user_id', otherRecruiterId);
        const notification = recruiterDashboard.body.notifications[0];

        expect(recruiterDashboard.status).toBe(200);
        expect(recruiterDashboard.body.notifications).toHaveLength(1);
        expect(notification).toMatchObject({
            recipient: recruiterId,
            type: 'APPLICATION_SUBMITTED',
            title: 'New Application Received',
            relatedJob: jobId,
            relatedApplication: applicationId,
        });
        expect(notification.recipient).not.toBe(applicantId);
        expect(otherRecruiterDashboard.status).toBe(200);
        expect(otherRecruiterDashboard.body.notifications).toHaveLength(0);
    });

    it('notifies the applicant dashboard when the recruiter updates the application status', async () => {
        const {
            recruiterId,
            applicantId,
            jobId,
            applicationId,
            submissionResponse,
        } = await submitApplicationForNotificationTests();
        expect(submissionResponse.status).toBe(201);

        const updateResponse = await request(app)
            .patch(`/api/applications/${applicationId}/status`)
            .set('test_user_id', recruiterId)
            .send({ status: 'Under Review' });
        const dashboard = await request(app)
            .get('/api/notifications')
            .set('test_user_id', applicantId);

        expect(updateResponse.status).toBe(200);
        expect(dashboard.status).toBe(200);
        expect(dashboard.body.notifications).toHaveLength(1);
        expect(dashboard.body.notifications[0]).toMatchObject({
            recipient: applicantId,
            type: 'APPLICATION_STATUS',
            title: 'Application Status Updated: Under Review',
            relatedJob: jobId,
            relatedApplication: applicationId,
        });
    });

    it('notifies the applicant dashboard when the application moves to Interview', async () => {
        const {
            recruiterId,
            applicantId,
            jobId,
            applicationId,
            submissionResponse,
        } = await submitApplicationForNotificationTests();
        expect(submissionResponse.status).toBe(201);

        const updateResponse = await request(app)
            .patch(`/api/applications/${applicationId}/status`)
            .set('test_user_id', recruiterId)
            .send({ status: 'Interview' });
        const dashboard = await request(app)
            .get('/api/notifications')
            .set('test_user_id', applicantId);

        expect(updateResponse.status).toBe(200);
        expect(dashboard.status).toBe(200);
        expect(dashboard.body.notifications).toHaveLength(1);
        expect(dashboard.body.notifications[0]).toMatchObject({
            recipient: applicantId,
            type: 'APPLICATION_STATUS',
            title: 'Application Status Updated: Interview',
            message: expect.stringContaining('"Interview".'),
            relatedJob: jobId,
            relatedApplication: applicationId,
        });
    });

    it('notifies the applicant dashboard when the recruiter extends an offer', async () => {
        const {
            recruiterId,
            applicantId,
            jobId,
            applicationId,
            submissionResponse,
        } = await submitApplicationForNotificationTests();
        expect(submissionResponse.status).toBe(201);

        const updateResponse = await request(app)
            .patch(`/api/applications/${applicationId}/status`)
            .set('test_user_id', recruiterId)
            .send({ status: 'Offered' });
        const dashboard = await request(app)
            .get('/api/notifications')
            .set('test_user_id', applicantId);

        expect(updateResponse.status).toBe(200);
        expect(dashboard.status).toBe(200);
        expect(dashboard.body.notifications).toHaveLength(1);
        expect(dashboard.body.notifications[0]).toMatchObject({
            recipient: applicantId,
            type: 'APPLICATION_STATUS',
            title: 'Application Status Updated: Offered',
            relatedJob: jobId,
            relatedApplication: applicationId,
        });
    });
});