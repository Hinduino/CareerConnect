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
const extractDocumentText = require('../src/utils/documentText');

let mongoServer;
const originalFetch = global.fetch;

async function createUser(role = 'job_seeker') {
    const user = await User.create({
        email: `user${Math.random()}@example.com`,
        password: 'password123',
        role,
    });
    return user._id.toString();
}

async function createResume(userId) {
    return Resume.create({
        user: userId,
        originalName: 'private-resume.pdf',
        contentType: 'application/pdf',
        size: 20,
        data: Buffer.from('%PDF-1.7 private resume'),
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

describe('Applicant resume feedback', () => {
    it('analyzes the applicant-owned resume and returns validated feedback', async () => {
        const applicantId = await createUser();
        const resume = await createResume(applicantId);
        extractDocumentText.mockResolvedValue({
            text: 'Five years of software engineering experience. Skills include JavaScript and React.',
            truncated: false,
        });
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            summary: 'A focused software engineering resume.',
                            strengths: ['Relevant experience is clearly stated.'],
                            recommendations: ['Add measurable outcomes to project descriptions.'],
                        }),
                    },
                }],
            }),
        });

        const response = await request(app)
            .post(`/api/resumes/${resume._id}/feedback`)
            .set('test_user_id', applicantId);

        expect(response.status).toBe(200);
        expect(response.body.feedback).toEqual({
            summary: 'A focused software engineering resume.',
            strengths: ['Relevant experience is clearly stated.'],
            recommendations: ['Add measurable outcomes to project descriptions.'],
        });
        expect(extractDocumentText).toHaveBeenCalledWith(expect.objectContaining({
            originalname: 'private-resume.pdf',
            mimetype: 'application/pdf',
        }));
        const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
        const promptData = JSON.parse(requestBody.messages[1].content);
        expect(promptData.resumeText).toContain('JavaScript and React');
        expect(requestBody.messages[1].content).not.toContain('private-resume.pdf');
    });

    it('requires an authenticated job seeker and hides resumes owned by other users', async () => {
        const ownerId = await createUser();
        const otherApplicantId = await createUser();
        const recruiterId = await createUser('recruiter');
        const resume = await createResume(ownerId);

        const unauthenticated = await request(app).post(`/api/resumes/${resume._id}/feedback`);
        const otherOwner = await request(app)
            .post(`/api/resumes/${resume._id}/feedback`)
            .set('test_user_id', otherApplicantId);
        const recruiter = await request(app)
            .post(`/api/resumes/${resume._id}/feedback`)
            .set('test_user_id', recruiterId);

        expect(unauthenticated.status).toBe(401);
        expect(otherOwner.status).toBe(404);
        expect(recruiter.status).toBe(403);
        expect(extractDocumentText).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects invalid resume IDs and unreadable resume files before contacting AI', async () => {
        const applicantId = await createUser();
        const invalidId = await request(app)
            .post('/api/resumes/invalid-id/feedback')
            .set('test_user_id', applicantId);
        const resume = await createResume(applicantId);
        extractDocumentText.mockRejectedValue(new Error('No readable text was found in the document'));

        const unreadable = await request(app)
            .post(`/api/resumes/${resume._id}/feedback`)
            .set('test_user_id', applicantId);

        expect(invalidId.status).toBe(400);
        expect(unreadable.status).toBe(400);
        expect(unreadable.body.error).toMatch(/no readable text/i);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('handles unavailable and malformed AI responses without logging response contents', async () => {
        const applicantId = await createUser();
        const resume = await createResume(applicantId);
        extractDocumentText.mockResolvedValue({ text: 'Resume text', truncated: false });
        const privateSentinel = 'PRIVATE_RESUME_CONTENT_SENTINEL';
        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch.mockResolvedValue({
            ok: false,
            status: 503,
            text: async () => privateSentinel,
        });

        const unavailable = await request(app)
            .post(`/api/resumes/${resume._id}/feedback`)
            .set('test_user_id', applicantId);

        expect(unavailable.status).toBe(502);
        expect(unavailable.body.error).toMatch(/temporarily unavailable/i);
        expect(errorLog.mock.calls.flat().join(' ')).not.toContain(privateSentinel);

        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'not valid json' } }],
            }),
        });
        const malformed = await request(app)
            .post(`/api/resumes/${resume._id}/feedback`)
            .set('test_user_id', applicantId);

        expect(malformed.status).toBe(502);
        expect(malformed.body.error).toMatch(/unreadable feedback/i);
        errorLog.mockRestore();
    });

    it('does not log resume text when document extraction fails', async () => {
        const applicantId = await createUser();
        const resume = await createResume(applicantId);
        extractDocumentText.mockRejectedValue(new Error('Parser error: PRIVATE_RESUME_CONTENT_SENTINEL'));
        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

        const response = await request(app)
            .post(`/api/resumes/${resume._id}/feedback`)
            .set('test_user_id', applicantId);

        expect(response.status).toBe(400);
        expect(errorLog.mock.calls.flat().join(' ')).not.toContain('PRIVATE_RESUME_CONTENT_SENTINEL');
        expect(global.fetch).not.toHaveBeenCalled();
        errorLog.mockRestore();
    });
});
