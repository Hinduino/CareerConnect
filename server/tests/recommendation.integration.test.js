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
const JobPosting = require('../src/models/JobPosting');
const Resume = require('../src/models/Resume');
const extractDocumentText = require('../src/utils/documentText');

let mongoServer;
const originalFetch = global.fetch;

async function createUser(overrides = {}) {
    const user = await User.create({
        email: `user${Math.random()}@example.com`,
        password: 'password123',
        role: 'job_seeker',
        location: 'Montreal',
        bio: 'Frontend engineer with React experience',
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
        description: 'Build user interfaces.',
        requirements: 'React and JavaScript experience.',
        postedBy,
        ...overrides,
    });
    return job;
}

async function createResume(userId) {
    return Resume.create({
        user: userId,
        originalName: 'resume.pdf',
        contentType: 'application/pdf',
        size: 12,
        data: Buffer.from('%PDF-1.4 secure test document'),
    });
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
});

describe('Personalized job recommendations', () => {
    it('sends only available jobs and resume text to AI, then returns authoritative job details', async () => {
        const applicantId = await createUser();
        const recruiterId = await createUser({ role: 'recruiter' });
        const resume = await createResume(applicantId);
        const activeJob = await createJob(recruiterId, { dueDate: new Date(Date.now() + 86400000) });
        await createJob(recruiterId, { isArchived: true });
        await createJob(recruiterId, { dueDate: new Date(Date.now() - 86400000) });
        await createJob(recruiterId, { title: 'No deadline role' });

        extractDocumentText.mockResolvedValue({ text: 'React and JavaScript skills', truncated: false });
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            recommendations: [{
                                jobId: activeJob._id.toString(),
                                reason: 'Your React experience matches the posting.',
                                matchedQualifications: ['React experience'],
                                gaps: ['The posting asks for three years of experience.'],
                            }],
                        }),
                    },
                }],
            }),
        });

        const response = await request(app)
            .post('/api/recommendations')
            .set('test_user_id', applicantId)
            .send({ resumeId: resume._id.toString() });

        expect(response.status).toBe(200);
        const extractedFile = extractDocumentText.mock.calls[0][0];
        expect(extractedFile.originalname).toBe('resume.pdf');
        expect(extractedFile.buffer.toString()).toBe('%PDF-1.4 secure test document');
        const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(requestBody).not.toHaveProperty('response_format');
        expect(requestBody.temperature).toBe(0);
        const sentData = requestBody.messages[1].content;
        const parsedData = JSON.parse(sentData);
        expect(parsedData.profile.bio).toContain('React experience');
        expect(parsedData.resumeText).toBe('React and JavaScript skills');
        expect(parsedData.candidateJobs.map((job) => job.id)).toEqual(expect.arrayContaining([
            activeJob._id.toString(),
        ]));
        expect(parsedData.candidateJobs).toHaveLength(2);
        expect(parsedData.candidateJobs.some((job) => job.title === 'No deadline role')).toBe(true);
        expect(response.body.recommendations[0]).toMatchObject({
            reason: 'Your React experience matches the posting.',
            matchedQualifications: ['React experience'],
            gaps: ['The posting asks for three years of experience.'],
            job: {
                id: activeJob._id.toString(),
                title: 'Frontend Developer',
                description: 'Build user interfaces.',
                category: 'Engineering',
            },
        });
    });

    it('normalizes text-block responses and JSON surrounded by explanatory text', async () => {
        const applicantId = await createUser();
        const recruiterId = await createUser({ role: 'recruiter' });
        const job = await createJob(recruiterId);
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: [
                            { type: 'text', text: 'Recommended match:' },
                            {
                                type: 'text',
                                text: `\`\`\`json\n{"recommendations":[{"jobId":"${job._id}","reason":"Your React experience is relevant.","matchedQualifications":["React experience"],"gaps":[]}]}\n\`\`\``,
                            },
                        ],
                    },
                }],
            }),
        });

        const response = await request(app)
            .post('/api/recommendations')
            .set('test_user_id', applicantId)
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.recommendations).toHaveLength(1);
        expect(response.body.recommendations[0]).toMatchObject({
            reason: 'Your React experience is relevant.',
            job: { id: job._id.toString() },
        });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('retries malformed recommendations once with stricter format instructions', async () => {
        const applicantId = await createUser();
        const recruiterId = await createUser({ role: 'recruiter' });
        const job = await createJob(recruiterId);
        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ choices: [{ message: { content: 'Not JSON' } }] }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                recommendations: [{
                                    jobId: job._id.toString(),
                                    reason: 'Your experience is relevant.',
                                    matchedQualifications: ['Relevant experience'],
                                    gaps: [],
                                }],
                            }),
                        },
                    }],
                }),
            });

        const response = await request(app)
            .post('/api/recommendations')
            .set('test_user_id', applicantId)
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.recommendations[0].job.id).toBe(job._id.toString());
        expect(global.fetch).toHaveBeenCalledTimes(2);
        const retryRequest = JSON.parse(global.fetch.mock.calls[1][1].body);
        expect(retryRequest.messages[0].content).toMatch(/previous response was not valid recommendation JSON/i);
        errorLog.mockRestore();
    });

    it("requires an applicant role and does not expose another user's resume", async () => {
        const recruiterId = await createUser({ role: 'recruiter' });
        const otherApplicantId = await createUser();
        const resume = await createResume(otherApplicantId);

        const recruiterResponse = await request(app)
            .post('/api/recommendations')
            .set('test_user_id', recruiterId)
            .send({});
        const resumeResponse = await request(app)
            .post('/api/recommendations')
            .set('test_user_id', await createUser())
            .send({ resumeId: resume._id.toString() });

        expect(recruiterResponse.status).toBe(403);
        expect(resumeResponse.status).toBe(404);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects invalid recommendation request fields before loading data or contacting AI', async () => {
        const applicantId = await createUser();

        const response = await request(app)
            .post('/api/recommendations')
            .set('test_user_id', applicantId)
            .send({ resumeId: { $ne: null }, extra: 'unexpected' });

        expect(response.status).toBe(400);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns a clear error when the selected resume has no readable text', async () => {
        const applicantId = await createUser();
        const recruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId);
        const resume = await createResume(applicantId);
        extractDocumentText.mockRejectedValue(new Error('No readable text was found in the document'));

        const response = await request(app)
            .post('/api/recommendations')
            .set('test_user_id', applicantId)
            .send({ resumeId: resume._id.toString() });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/no readable text/i);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not log parser errors that could contain resume text', async () => {
        const applicantId = await createUser();
        const recruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId);
        const resume = await createResume(applicantId);
        extractDocumentText.mockRejectedValue(new Error('Parser error: PRIVATE_RESUME_CONTENT_SENTINEL'));
        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

        const response = await request(app)
            .post('/api/recommendations')
            .set('test_user_id', applicantId)
            .send({ resumeId: resume._id.toString() });

        expect(response.status).toBe(400);
        expect(errorLog.mock.calls.flat().join(' ')).not.toContain('PRIVATE_RESUME_CONTENT_SENTINEL');
        expect(global.fetch).not.toHaveBeenCalled();
        errorLog.mockRestore();
    });

    it('uses the applicant profile as it exists on each refresh', async () => {
        const applicantId = await createUser({ bio: 'Initial profile information' });
        const recruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId);
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: '{"recommendations":[]}' } }],
            }),
        });

        await request(app)
            .post('/api/recommendations')
            .set('test_user_id', applicantId)
            .send({});
        await User.findByIdAndUpdate(applicantId, { bio: 'Updated profile information' });
        await request(app)
            .post('/api/recommendations')
            .set('test_user_id', applicantId)
            .send({});

        const profileSnapshots = global.fetch.mock.calls.map((call) => (
            JSON.parse(JSON.parse(call[1].body).messages[1].content).profile.bio
        ));
        expect(profileSnapshots).toEqual(['Initial profile information', 'Updated profile information']);
    });

    it('rejects AI results that refer to jobs outside the available candidate set', async () => {
        const applicantId = await createUser();
        const recruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId);
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            recommendations: [{
                                jobId: new mongoose.Types.ObjectId().toString(),
                                reason: 'Untrusted job suggestion.',
                                matchedQualifications: [],
                                gaps: [],
                            }],
                        }),
                    },
                }],
            }),
        });

        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
        const response = await request(app)
            .post('/api/recommendations')
            .set('test_user_id', applicantId)
            .send({});

        expect(response.status).toBe(502);
        expect(response.body.error).toMatch(/invalid job match/i);
        errorLog.mockRestore();
    });

    it('does not log upstream error bodies and reports unavailable AI services clearly', async () => {
        const applicantId = await createUser();
        const recruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId);
        const privateSentinel = 'PRIVATE_RESUME_CONTENT_SENTINEL';
        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch.mockResolvedValue({
            ok: false,
            status: 503,
            text: async () => privateSentinel,
        });

        const response = await request(app)
            .post('/api/recommendations')
            .set('test_user_id', applicantId)
            .send({});

        expect(response.status).toBe(502);
        expect(response.body.error).toMatch(/temporarily unavailable/i);
        expect(errorLog.mock.calls.flat().join(' ')).not.toContain(privateSentinel);
        errorLog.mockRestore();
    });

    it('returns a clear error for malformed AI response bodies', async () => {
        const applicantId = await createUser();
        const recruiterId = await createUser({ role: 'recruiter' });
        await createJob(recruiterId);
        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => { throw new SyntaxError('invalid JSON'); },
        });

        const response = await request(app)
            .post('/api/recommendations')
            .set('test_user_id', applicantId)
            .send({});

        expect(response.status).toBe(502);
        expect(response.body.error).toMatch(/invalid response/i);
        errorLog.mockRestore();
    });
});
