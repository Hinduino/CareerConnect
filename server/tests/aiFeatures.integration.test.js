// SCRUM-305: Integration tests for SCRUM-110 (AI-Powered Resume Feedback
// and AI Job Matching), filling gaps not covered by the PR #61 test files:
//   - the original resume stays unchanged after AI analysis
//   - an AI outage does not affect resume management
//   - recommendations skip the AI when there is nothing to match
//   - the full workflow: recommended job -> save -> apply
//   - expired postings are not offered as available opportunities
//
// The AI service is never called for real: global.fetch is mocked.
// Tests written with `it.failing` document known bugs. They pass while the
// bug exists and start failing once it is fixed, as a reminder to turn them
// into normal `it` tests.

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
jest.mock('../src/utils/documentText', () => jest.fn());

const app = require('../src/server');
const User = require('../src/models/User');
const Resume = require('../src/models/Resume');
const JobPosting = require('../src/models/JobPosting');
const Application = require('../src/models/Application');
const extractDocumentText = require('../src/utils/documentText');

let mongoServer;
const originalFetch = global.fetch;

const DAY = 24 * 60 * 60 * 1000;
const RESUME_BYTES = Buffer.from('%PDF-1.7 original resume bytes');

async function createUser(overrides = {}) {
    const user = await User.create({
        email: `user${Math.random()}@example.com`,
        password: 'password123',
        role: 'job_seeker',
        ...overrides,
    });
    return user._id.toString();
}

async function createJob(postedBy, overrides = {}) {
    const job = await JobPosting.create({
        title: 'Frontend Developer',
        company: 'Acme Corp',
        location: 'Montreal',
        category: 'Engineering',
        description: 'Build user interfaces with React.',
        requirements: 'React, JavaScript',
        postedBy,
        ...overrides,
    });
    return job._id.toString();
}

async function createResume(userId) {
    return Resume.create({
        user: userId,
        originalName: 'resume.pdf',
        contentType: 'application/pdf',
        size: RESUME_BYTES.length,
        data: RESUME_BYTES,
    });
}

// What the AI service sends back, wrapped the way fetch() returns it
function aiReply(content) {
    return {
        ok: true,
        json: async () => ({ choices: [{ message: { content } }] }),
    };
}

function feedbackReply(overrides = {}) {
    return aiReply(JSON.stringify({
        summary: 'A solid frontend resume.',
        strengths: ['Clear React experience.'],
        recommendations: ['Add measurable results.'],
        ...overrides,
    }));
}

function recommendationReply(jobIds) {
    return aiReply(JSON.stringify({
        recommendations: jobIds.map((jobId) => ({
            jobId,
            reason: 'Strong React background matches the role.',
            matchedQualifications: ['React'],
            gaps: [],
        })),
    }));
}

function requestFeedback(resumeId, userId) {
    return request(app).post(`/api/resumes/${resumeId}/feedback`).set('test_user_id', userId);
}

function requestRecommendations(userId, body = {}) {
    return request(app).post('/api/recommendations').set('test_user_id', userId).send(body);
}

// The data the server sent to the AI service in its first call
function aiPromptData() {
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    return body.messages;
}

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.disconnect();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    global.fetch = originalFetch;
});

beforeEach(async () => {
    for (const collection of Object.values(mongoose.connection.collections)) {
        await collection.deleteMany();
    }
    global.fetch = jest.fn();
    extractDocumentText.mockReset();
    extractDocumentText.mockResolvedValue({ text: 'Frontend developer. Skills: React, JavaScript.', truncated: false });
    // Keeps expected server error logs out of the test output
    // (the Jest config restores this spy after each test).
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

// ==========================================================================
// AI-Powered Resume Feedback
// ==========================================================================
describe('Resume feedback: the original resume is never changed', () => {
    async function snapshot(resumeId) {
        const stored = await Resume.findById(resumeId).select('+data').lean();
        return {
            originalName: stored.originalName,
            contentType: stored.contentType,
            size: stored.size,
            data: Buffer.from(stored.data.buffer || stored.data).toString('base64'),
            updatedAt: stored.updatedAt?.toISOString(),
        };
    }

    it('keeps the stored resume identical after successful feedback', async () => {
        const applicantId = await createUser();
        const resume = await createResume(applicantId);
        const before = await snapshot(resume._id);
        global.fetch.mockResolvedValue(feedbackReply());

        const response = await requestFeedback(resume._id, applicantId);

        expect(response.status).toBe(200);
        expect(await snapshot(resume._id)).toEqual(before);
        expect(await Resume.countDocuments({ user: applicantId })).toBe(1);
    });

    it('still lets the applicant download the exact same file afterwards', async () => {
        const applicantId = await createUser();
        const resume = await createResume(applicantId);
        global.fetch.mockResolvedValue(feedbackReply());

        await requestFeedback(resume._id, applicantId);
        const download = await request(app)
            .get(`/api/resumes/${resume._id}/file`)
            .set('test_user_id', applicantId)
            .buffer(true)
            .parse((res, done) => {
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => done(null, Buffer.concat(chunks)));
            });

        expect(download.status).toBe(200);
        expect(download.body.equals(RESUME_BYTES)).toBe(true);
    });

    it('keeps the stored resume identical when the AI service fails', async () => {
        const applicantId = await createUser();
        const resume = await createResume(applicantId);
        const before = await snapshot(resume._id);
        global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

        const response = await requestFeedback(resume._id, applicantId);

        expect(response.status).toBe(502);
        expect(await snapshot(resume._id)).toEqual(before);
    });
});

describe('Resume feedback: AI outages do not affect resume management', () => {
    it('lists, uploads and deletes resumes normally after a failed feedback request', async () => {
        const applicantId = await createUser();
        const resume = await createResume(applicantId);
        global.fetch.mockRejectedValue(new Error('network down'));

        const feedback = await requestFeedback(resume._id, applicantId);
        expect(feedback.status).toBe(502);
        expect(feedback.body.error).toBe('Could not connect to the resume feedback service. Please try again.');

        const list = await request(app).get('/api/resumes').set('test_user_id', applicantId);
        expect(list.status).toBe(200);
        expect(list.body).toHaveLength(1);

        const upload = await request(app)
            .post('/api/resumes')
            .set('test_user_id', applicantId)
            .attach('resume', RESUME_BYTES, { filename: 'second.pdf', contentType: 'application/pdf' });
        expect(upload.status).toBe(201);

        const remove = await request(app).delete(`/api/resumes/${resume._id}`).set('test_user_id', applicantId);
        expect(remove.status).toBeLessThan(300);
        expect(await Resume.countDocuments({ user: applicantId })).toBe(1);
    });

    it('explains a timeout clearly', async () => {
        const applicantId = await createUser();
        const resume = await createResume(applicantId);
        const timeout = new Error('timed out');
        timeout.name = 'TimeoutError';
        global.fetch.mockRejectedValue(timeout);

        const response = await requestFeedback(resume._id, applicantId);

        expect(response.status).toBe(502);
        expect(response.body.error).toBe('Resume feedback took too long to generate. Please try again.');
    });
});

describe('Resume feedback: processing the AI response', () => {
    it('accepts feedback wrapped in a ```json code block', async () => {
        const applicantId = await createUser();
        const resume = await createResume(applicantId);
        global.fetch.mockResolvedValue(aiReply(
            '```json\n{"summary":"Good.","strengths":["React"],"recommendations":["Add metrics"]}\n```'
        ));

        const response = await requestFeedback(resume._id, applicantId);

        expect(response.status).toBe(200);
        expect(response.body.feedback).toEqual({
            summary: 'Good.',
            strengths: ['React'],
            recommendations: ['Add metrics'],
        });
    });

    it('limits strengths and recommendations to 8 each and trims long items', async () => {
        const applicantId = await createUser();
        const resume = await createResume(applicantId);
        const many = Array.from({ length: 12 }, (_, i) => `Item ${i + 1}`);
        global.fetch.mockResolvedValue(feedbackReply({
            strengths: many,
            recommendations: ['x'.repeat(1000), ...many],
        }));

        const response = await requestFeedback(resume._id, applicantId);

        expect(response.body.feedback.strengths).toHaveLength(8);
        expect(response.body.feedback.recommendations).toHaveLength(8);
        expect(response.body.feedback.recommendations[0]).toHaveLength(400);
    });

    it.each([
        ['missing summary', { summary: '' }],
        ['missing strengths', { strengths: undefined }],
        ['recommendations that are not text', { recommendations: [42] }],
        ['an empty recommendation', { recommendations: ['   '] }],
    ])('rejects feedback with %s', async (_label, overrides) => {
        const applicantId = await createUser();
        const resume = await createResume(applicantId);
        global.fetch.mockResolvedValue(feedbackReply(overrides));

        const response = await requestFeedback(resume._id, applicantId);

        expect(response.status).toBe(502);
        expect(response.body.error).toBe('The AI service returned incomplete feedback.');
    });

    it('does not send the resume file name to the AI service', async () => {
        const applicantId = await createUser();
        const resume = await createResume(applicantId);
        global.fetch.mockResolvedValue(feedbackReply());

        await requestFeedback(resume._id, applicantId);

        expect(JSON.stringify(aiPromptData())).not.toContain('resume.pdf');
    });
});

// ==========================================================================
// AI Job Matching Suggestions
// ==========================================================================
describe('Job recommendations: nothing to match', () => {
    it('asks for a profile or resume instead of calling the AI when the profile is empty', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId);
        const applicantId = await createUser();

        const response = await requestRecommendations(applicantId);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            recommendations: [],
            message: 'Add a profile summary or resume to get personalized job recommendations.',
        });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('treats a profile with only blank text as empty', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId);
        const applicantId = await createUser({ bio: '   ', location: '  ' });

        const response = await requestRecommendations(applicantId);

        expect(response.body.recommendations).toEqual([]);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('says there are no active postings when every job is archived or expired', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId, { title: 'Archived role', isArchived: true });
        await createJob(recruiterId, { title: 'Expired role', dueDate: new Date(Date.now() - DAY) });
        const applicantId = await createUser({ bio: 'React developer' });

        const response = await requestRecommendations(applicantId);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            recommendations: [],
            message: 'There are no active job postings available right now.',
        });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns an empty list when the AI finds no reasonable match', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId);
        const applicantId = await createUser({ bio: 'Pastry chef' });
        global.fetch.mockResolvedValue(recommendationReply([]));

        const response = await requestRecommendations(applicantId);

        expect(response.status).toBe(200);
        expect(response.body.recommendations).toEqual([]);
    });
});

describe('Job recommendations: which jobs are offered', () => {
    it('only sends active postings to the AI (not archived, not expired)', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId, { title: 'Open role' });
        await createJob(recruiterId, { title: 'Future deadline', dueDate: new Date(Date.now() + 7 * DAY) });
        await createJob(recruiterId, { title: 'Archived role', isArchived: true });
        await createJob(recruiterId, { title: 'Expired role', dueDate: new Date(Date.now() - DAY) });
        const applicantId = await createUser({ bio: 'React developer' });
        global.fetch.mockResolvedValue(recommendationReply([]));

        await requestRecommendations(applicantId);

        const sentJobs = JSON.parse(aiPromptData()[1].content).candidateJobs.map((job) => job.title).sort();
        expect(sentJobs).toEqual(['Future deadline', 'Open role']);
    });

    // The fake AI recommends every job the server sent it
    function recommendAllCandidates() {
        global.fetch.mockImplementation(async (_url, options) => {
            const messages = JSON.parse(options.body).messages;
            const candidates = JSON.parse(messages[1].content).candidateJobs;
            return recommendationReply(candidates.map((job) => job.id));
        });
    }

    it('sends at most 5 active postings to the AI, newest first', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        for (let i = 0; i < 7; i += 1) {
            await createJob(recruiterId, { title: `Role ${i}`, createdAt: new Date(Date.now() - (7 - i) * DAY) });
        }
        const applicantId = await createUser({ bio: 'React developer' });
        global.fetch.mockResolvedValue(recommendationReply([]));

        await requestRecommendations(applicantId);

        const sentJobs = JSON.parse(aiPromptData()[1].content).candidateJobs.map((job) => job.title);
        expect(sentJobs).toEqual(['Role 6', 'Role 5', 'Role 4', 'Role 3', 'Role 2']);
    });

    it('returns at most 3 recommendations', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        for (let i = 0; i < 7; i += 1) {
            await createJob(recruiterId, { title: `Role ${i}` });
        }
        const applicantId = await createUser({ bio: 'React developer' });
        recommendAllCandidates();

        const response = await requestRecommendations(applicantId);

        expect(response.status).toBe(200);
        expect(response.body.recommendations).toHaveLength(3);
    });

    it('rejects a job the server did not send to the AI', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const oldestJobId = await createJob(recruiterId, { title: 'Oldest role', createdAt: new Date(Date.now() - 30 * DAY) });
        for (let i = 0; i < 5; i += 1) {
            await createJob(recruiterId, { title: `Newer role ${i}` });
        }
        const applicantId = await createUser({ bio: 'React developer' });
        global.fetch.mockResolvedValue(recommendationReply([oldestJobId]));

        const response = await requestRecommendations(applicantId);

        expect(response.status).toBe(502);
        expect(response.body.error).toBe('The recommendation service returned an invalid job match.');
    });

    it('rejects the same job recommended twice', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const jobId = await createJob(recruiterId);
        const applicantId = await createUser({ bio: 'React developer' });
        global.fetch.mockResolvedValue(recommendationReply([jobId, jobId]));

        const response = await requestRecommendations(applicantId);

        expect(response.status).toBe(502);
        expect(response.body.error).toBe('The recommendation service returned an invalid job match.');
    });
});

describe('Job recommendations: complete workflow', () => {
    it('lets the applicant view, save and apply to a recommended job', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const jobId = await createJob(recruiterId);
        const applicantId = await createUser({ bio: 'React developer' });
        const resume = await createResume(applicantId);
        global.fetch.mockResolvedValue(recommendationReply([jobId]));

        const recommendations = await requestRecommendations(applicantId, { resumeId: resume._id.toString() });
        expect(recommendations.status).toBe(200);
        const recommended = recommendations.body.recommendations[0].job;
        expect(recommended).toEqual(expect.objectContaining({ id: jobId, title: 'Frontend Developer' }));

        const details = await request(app).get(`/api/jobs/${recommended.id}`);
        expect(details.status).toBe(200);
        expect(details.body.title).toBe('Frontend Developer');

        const save = await request(app)
            .post(`/api/jobs/${recommended.id}/favorite`)
            .set('test_user_id', applicantId);
        expect(save.status).toBe(200);
        const saved = await request(app).get('/api/jobs/favorites').set('test_user_id', applicantId);
        expect(saved.body.map((job) => job._id)).toEqual([jobId]);

        const apply = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId: recommended.id, resumeId: resume._id.toString() });
        expect(apply.status).toBe(201);
        expect(await Application.countDocuments({ applicant: applicantId, job: jobId })).toBe(1);
    });

    it('blocks applying to a posting that expired after it was recommended', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const jobId = await createJob(recruiterId, { dueDate: new Date(Date.now() + DAY) });
        const applicantId = await createUser({ bio: 'React developer' });
        const resume = await createResume(applicantId);
        global.fetch.mockResolvedValue(recommendationReply([jobId]));
        await requestRecommendations(applicantId);

        await JobPosting.findByIdAndUpdate(jobId, { dueDate: new Date(Date.now() - DAY) });
        const apply = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId, resumeId: resume._id.toString() });

        expect(apply.status).toBe(400);
        expect(apply.body.error).toBe('This job posting has expired and no longer accepts applications.');
    });
});

// ==========================================================================
// Expired postings elsewhere in the app
// ==========================================================================
describe('Expired postings', () => {
    // Known bug: PR #61 says the job list "only includes available job
    // postings", but GET /api/jobs filters out archived postings only, so
    // expired postings still appear in Find Jobs.
    it.failing('KNOWN BUG: hides expired postings from the public job list', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId, { title: 'Open role' });
        await createJob(recruiterId, { title: 'Expired role', dueDate: new Date(Date.now() - DAY) });

        const response = await request(app).get('/api/jobs');

        expect(response.body.map((job) => job.title)).toEqual(['Open role']);
    });

    // Known bug: the chat assistant's job context filters out archived
    // postings but not expired ones, so it can recommend jobs that no longer
    // accept applications.
    it.failing('KNOWN BUG: does not give expired postings to the chat assistant', async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId, { title: 'Open role' });
        await createJob(recruiterId, { title: 'Expired role', dueDate: new Date(Date.now() - DAY) });
        global.fetch.mockResolvedValue(aiReply('Here are some jobs.'));

        const response = await request(app)
            .post('/api/chat')
            .send({ messages: [{ role: 'user', content: 'Which jobs can I apply to?' }] });

        expect(response.status).toBe(200);
        const systemPrompt = aiPromptData()[0].content;
        expect(systemPrompt).toContain('Open role');
        expect(systemPrompt).not.toContain('Expired role');
    });
});