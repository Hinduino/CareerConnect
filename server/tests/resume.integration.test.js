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
const Resume = require('../src/models/Resume');

let mongoServer;

function parseBuffer(response, callback) {
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => callback(null, Buffer.concat(chunks)));
}

async function createUser(email = 'applicant@example.com') {
    const user = await User.create({ email, password: 'password123', name: 'Jane Doe' });
    return user._id.toString();
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

describe('Resume routes (multi-resume support)', () => {
    it('requires authentication for every route', async () => {
        const list = await request(app).get('/api/resumes');
        const upload = await request(app).post('/api/resumes');
        const replace = await request(app).put('/api/resumes/507f1f77bcf86cd799439011');
        const del = await request(app).delete('/api/resumes/507f1f77bcf86cd799439011');
        const file = await request(app).get('/api/resumes/507f1f77bcf86cd799439011/file');

        expect(list.status).toBe(401);
        expect(upload.status).toBe(401);
        expect(replace.status).toBe(401);
        expect(del.status).toBe(401);
        expect(file.status).toBe(401);
    });

    it('starts with an empty list and allows uploading more than one resume', async () => {
        const userId = await createUser();

        const empty = await request(app).get('/api/resumes').set('test_user_id', userId);
        expect(empty.status).toBe(200);
        expect(empty.body).toEqual([]);

        const first = await request(app)
            .post('/api/resumes')
            .set('test_user_id', userId)
            .attach('resume', Buffer.from('%PDF-1'), { filename: 'resume.pdf', contentType: 'application/pdf' });
        const second = await request(app)
            .post('/api/resumes')
            .set('test_user_id', userId)
            .attach('resume', Buffer.from('%PDF-2'), { filename: 'cover.pdf', contentType: 'application/pdf' });

        expect(first.status).toBe(201);
        expect(first.body).toMatchObject({ originalName: 'resume.pdf' });
        expect(first.body).not.toHaveProperty('data');
        expect(second.status).toBe(201);

        const list = await request(app).get('/api/resumes').set('test_user_id', userId);
        expect(list.status).toBe(200);
        expect(list.body).toHaveLength(2);
        expect(list.body.map((r) => r.originalName).sort()).toEqual(['cover.pdf', 'resume.pdf']);
    });

    it('rejects disallowed file types', async () => {
        const userId = await createUser();

        const upload = await request(app)
            .post('/api/resumes')
            .set('test_user_id', userId)
            .attach('resume', Buffer.from('plain text'), { filename: 'resume.txt', contentType: 'text/plain' });

        expect(upload.status).toBe(400);
        expect(upload.body.error).toMatch(/Only PDF, DOC, and DOCX/);
    });

    it('downloads a resume’s bytes only for its owner', async () => {
        const ownerId = await createUser('owner@example.com');
        const otherId = await createUser('other@example.com');
        const resume = await Resume.create({
            user: ownerId,
            originalName: 'resume.pdf',
            contentType: 'application/pdf',
            size: 4,
            data: Buffer.from('test'),
        });

        const ownerDownload = await request(app)
            .get(`/api/resumes/${resume._id}/file`)
            .set('test_user_id', ownerId)
            .buffer(true)
            .parse(parseBuffer);
        expect(ownerDownload.status).toBe(200);
        expect(Buffer.compare(ownerDownload.body, Buffer.from('test'))).toBe(0);

        const otherDownload = await request(app)
            .get(`/api/resumes/${resume._id}/file`)
            .set('test_user_id', otherId);
        expect(otherDownload.status).toBe(404);
    });

    it('replaces a resume\'s file in place, only for its owner, keeping its id', async () => {
        const ownerId = await createUser('owner3@example.com');
        const otherId = await createUser('other3@example.com');
        const resume = await Resume.create({
            user: ownerId,
            originalName: 'resume.pdf',
            contentType: 'application/pdf',
            size: 4,
            data: Buffer.from('test'),
        });

        const deniedReplace = await request(app)
            .put(`/api/resumes/${resume._id}`)
            .set('test_user_id', otherId)
            .attach('resume', Buffer.from('%PDF-new'), { filename: 'new.pdf', contentType: 'application/pdf' });
        expect(deniedReplace.status).toBe(404);

        const replace = await request(app)
            .put(`/api/resumes/${resume._id}`)
            .set('test_user_id', ownerId)
            .attach('resume', Buffer.from('%PDF-new'), { filename: 'new.pdf', contentType: 'application/pdf' });
        expect(replace.status).toBe(200);
        expect(replace.body).toMatchObject({ id: resume._id.toString(), originalName: 'new.pdf' });

        const stored = await Resume.findById(resume._id).select('+data');
        expect(stored.originalName).toBe('new.pdf');
        expect(Buffer.from(stored.data)).toEqual(Buffer.from('%PDF-new'));
    });

    it('only deletes a resume that belongs to the requesting user', async () => {
        const ownerId = await createUser('owner2@example.com');
        const otherId = await createUser('other2@example.com');
        const resume = await Resume.create({
            user: ownerId,
            originalName: 'resume.pdf',
            contentType: 'application/pdf',
            size: 4,
            data: Buffer.from('test'),
        });

        const deniedDelete = await request(app)
            .delete(`/api/resumes/${resume._id}`)
            .set('test_user_id', otherId);
        expect(deniedDelete.status).toBe(404);

        const ownedDelete = await request(app)
            .delete(`/api/resumes/${resume._id}`)
            .set('test_user_id', ownerId);
        expect(ownedDelete.status).toBe(204);

        expect(await Resume.findById(resume._id)).toBeNull();
    });
});

    it('rejects requests with invalid resume IDs', async () => {
        const userId = await createUser();

        const getFile = await request(app)
            .get('/api/resumes/invalid-id/file')
            .set('test_user_id', userId);
        expect(getFile.status).toBe(400);
        expect(getFile.body.error).toBe('Invalid resume ID');

        const put = await request(app)
            .put('/api/resumes/invalid-id')
            .set('test_user_id', userId)
            .attach('resume', Buffer.from('%PDF'), { filename: 'test.pdf', contentType: 'application/pdf' });
        expect(put.status).toBe(400);
        expect(put.body.error).toBe('Invalid resume ID');

        const del = await request(app)
            .delete('/api/resumes/invalid-id')
            .set('test_user_id', userId);
        expect(del.status).toBe(400);
        expect(del.body.error).toBe('Invalid resume ID');
    });

    it('rejects POST requests with no file uploaded', async () => {
        const userId = await createUser();

        const response = await request(app)
            .post('/api/resumes')
            .set('test_user_id', userId)
            .send();
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('No file was uploaded');
    });

    it('rejects PUT requests with no file uploaded', async () => {
        const userId = await createUser();
        const resumeId = new mongoose.Types.ObjectId();

        const response = await request(app)
            .put(`/api/resumes/${resumeId}`)
            .set('test_user_id', userId)
            .send();
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('No file was uploaded');
    });

    it('returns 404 when trying to get non-existent resume file', async () => {
        const userId = await createUser();
        const fakeId = new mongoose.Types.ObjectId();

        const response = await request(app)
            .get(`/api/resumes/${fakeId}/file`)
            .set('test_user_id', userId);
        
        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Resume not found');
    });

    it('supports download query parameter to change content disposition', async () => {
        const userId = await createUser();
        const resume = await Resume.create({
            user: userId,
            originalName: 'resume.pdf',
            contentType: 'application/pdf',
            size: 4,
            data: Buffer.from('test'),
        });

        const inline = await request(app)
            .get(`/api/resumes/${resume._id}/file`)
            .set('test_user_id', userId)
            .buffer(true)
            .parse(parseBuffer);
        
        expect(inline.status).toBe(200);
        expect(inline.headers['content-disposition']).toContain('inline');

        const download = await request(app)
            .get(`/api/resumes/${resume._id}/file?download=true`)
            .set('test_user_id', userId)
            .buffer(true)
            .parse(parseBuffer);
        
        expect(download.status).toBe(200);
        expect(download.headers['content-disposition']).toContain('attachment');
    });

    it('returns 404 when replacing non-existent resume', async () => {
        const userId = await createUser();
        const fakeId = new mongoose.Types.ObjectId();

        const response = await request(app)
            .put(`/api/resumes/${fakeId}`)
            .set('test_user_id', userId)
            .attach('resume', Buffer.from('%PDF-new'), { filename: 'new.pdf', contentType: 'application/pdf' });
        
        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Resume not found');
    });

    it('returns 404 when deleting non-existent resume', async () => {
        const userId = await createUser();
        const fakeId = new mongoose.Types.ObjectId();

        const response = await request(app)
            .delete(`/api/resumes/${fakeId}`)
            .set('test_user_id', userId);
        
        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Resume not found');
    });
