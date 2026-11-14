const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Set up mandatory environment variables before importing the app
process.env.JWT_SECRET = 'test_secret_key_12345';
process.env.MONGO_URI = 'mongodb://localhost:27017/'; // Will be overridden

// Mock the authentication middleware so we can easily test protected routes
jest.mock('../src/middleware/auth', () => {
    const jwt = require('jsonwebtoken');
    return (req, res, next) => {
        // Look for a test header we pass during supertest calls
        if (req.headers.test_user_id) {
            req.user = { id: req.headers.test_user_id };
            return next();
        }

        const authorization = req.headers.authorization || '';
        const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
        if (token) {
            try {
                const payload = jwt.verify(token, process.env.JWT_SECRET);
                req.user = { id: payload.userId };
                return next();
            } catch {
                return res.status(401).json({ error: 'Unauthorized' });
            }
        }

        return res.status(401).json({ error: 'Unauthorized' });
    };
});

// Import the app instance from server.js
const app = require('../src/server'); 
const User = require('../src/models/User');
const JobPosting = require('../src/models/JobPosting');
const Resume = require('../src/models/Resume');
const Notification = require('../src/models/Notification');
const { sendUpcomingApplicationReminders } = require('../src/services/applicationReminderService');

let mongoServer;

beforeAll(async () => {
    // Spin up an isolated, in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    // Disconnect any existing global connections and reconnect to memory DB
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(uri);
});

afterAll(async () => {
    // Cleanup and shut down connection gracefully
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    // Clear out data between individual test blocks to keep them pure
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany();
    }
});

describe('CareerConnect Integration Tests', () => {
    
    // 1. Health Check Test
    describe('GET /', () => {
        it('should return a 200 status and running message', async () => {
            const res = await request(app).get('/');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'CareerConnect Server is running!');
        });
    });

    describe('Notification integration tests', () => {
        async function createApplicationScenario(dueDate = null) {
            const recruiter = await User.create({
                email: 'notification-recruiter@example.com',
                password: 'password123',
                name: 'Recruiter',
                role: 'recruiter',
            });
            const applicant = await User.create({
                email: 'notification-applicant@example.com',
                password: 'password123',
                name: 'Applicant',
                role: 'job_seeker',
            });
            const job = await JobPosting.create({
                title: 'Software Engineer',
                company: 'Acme Corp',
                location: 'Remote',
                category: 'Engineering',
                description: 'Build great things.',
                requirements: 'Experience required',
                postedBy: recruiter._id,
                dueDate,
            });
            const resume = await Resume.create({
                user: applicant._id,
                originalName: 'resume.pdf',
                contentType: 'application/pdf',
                size: 4,
                data: Buffer.from('test'),
            });
            const submission = await request(app)
                .post('/api/applications')
                .set('test_user_id', applicant._id.toString())
                .send({ jobId: job._id.toString(), resumeId: resume._id.toString() });

            return { recruiter, applicant, job, submission };
        }

        it('sends the recruiter a notification when an applicant declines an offer', async () => {
            const { recruiter, applicant, job, submission } = await createApplicationScenario();
            expect(submission.status).toBe(201);
            const applicationId = submission.body.application._id;

            const offer = await request(app)
                .patch(`/api/applications/${applicationId}/status`)
                .set('test_user_id', recruiter._id.toString())
                .send({ status: 'Offered' });
            const decline = await request(app)
                .patch(`/api/applications/${applicationId}/decline-offer`)
                .set('test_user_id', applicant._id.toString());
            const dashboard = await request(app)
                .get('/api/notifications')
                .set('test_user_id', recruiter._id.toString());
            const notification = dashboard.body.notifications.find(
                (item) => item.title === 'Job Offer Declined'
            );

            expect(offer.status).toBe(200);
            expect(decline.status).toBe(200);
            expect(dashboard.status).toBe(200);
            expect(notification).toMatchObject({
                recipient: recruiter._id.toString(),
                type: 'APPLICATION_STATUS',
                relatedJob: job._id.toString(),
                relatedApplication: applicationId,
            });
            expect(await Notification.countDocuments({
                recipient: recruiter._id,
                title: 'Job Offer Declined',
            })).toBe(1);
        });

        it.each([7, 3, 1])(
            'creates and returns a due-date reminder %i day(s) before deadline',
            async (daysUntilDue) => {
                const now = new Date('2026-11-13T12:00:00.000Z');
                const dueDate = new Date(Date.UTC(
                    now.getUTCFullYear(),
                    now.getUTCMonth(),
                    now.getUTCDate() + daysUntilDue
                ));
                const { applicant, job, submission } = await createApplicationScenario(dueDate);
                expect(submission.status).toBe(201);
                const applicationId = submission.body.application._id;

                await sendUpcomingApplicationReminders(now);

                const dashboard = await request(app)
                    .get('/api/notifications')
                    .set('test_user_id', applicant._id.toString());
                const notification = dashboard.body.notifications.find(
                    (item) => item.type === 'REMINDER'
                );
                const storedNotification = await Notification.findOne({
                    recipient: applicant._id,
                    type: 'REMINDER',
                });

                expect(dashboard.status).toBe(200);
                expect(notification).toMatchObject({
                    recipient: applicant._id.toString(),
                    title: `Application Deadline in ${daysUntilDue} Day${daysUntilDue === 1 ? '' : 's'}`,
                    relatedJob: job._id.toString(),
                    relatedApplication: applicationId,
                });
                expect(storedNotification).not.toBeNull();
                expect(storedNotification.relatedJob.toString()).toBe(job._id.toString());

                await sendUpcomingApplicationReminders(now);
                expect(await Notification.countDocuments({
                    recipient: applicant._id,
                    type: 'REMINDER',
                })).toBe(1);
            }
        );

        it('persists read and unread states and updates the dashboard unread count', async () => {
            const { applicant, job } = await createApplicationScenario();
            const unreadNotification = await Notification.create({
                recipient: applicant._id,
                type: 'SYSTEM',
                title: 'Unread notification',
                message: 'Not read yet.',
                relatedJob: job._id,
            });
            const alreadyReadNotification = await Notification.create({
                recipient: applicant._id,
                type: 'SYSTEM',
                title: 'Read notification',
                message: 'Already read.',
                relatedJob: job._id,
                isRead: true,
            });

            const beforeRead = await request(app)
                .get('/api/notifications')
                .set('test_user_id', applicant._id.toString());
            expect(beforeRead.status).toBe(200);
            expect(beforeRead.body.unreadCount).toBe(1);
            expect((await Notification.findById(unreadNotification._id)).isRead).toBe(false);
            expect((await Notification.findById(alreadyReadNotification._id)).isRead).toBe(true);

            const markRead = await request(app)
                .patch(`/api/notifications/${unreadNotification._id}/read`)
                .set('test_user_id', applicant._id.toString());
            const afterRead = await request(app)
                .get('/api/notifications')
                .set('test_user_id', applicant._id.toString());

            expect(markRead.status).toBe(200);
            expect((await Notification.findById(unreadNotification._id)).isRead).toBe(true);
            expect(afterRead.body.unreadCount).toBe(0);
        });

        it('keeps a user’s notifications available after logout and a later login', async () => {
            const registration = await request(app)
                .post('/api/register')
                .send({
                    email: 'notification-session@example.com',
                    password: 'Secure123!',
                    confirmPassword: 'Secure123!',
                });
            expect(registration.status).toBe(201);
            const userId = registration.body.user.id;

            const notification = await Notification.create({
                recipient: userId,
                type: 'SYSTEM',
                title: 'Persistent notification',
                message: 'This notification remains stored across sessions.',
            });

            const firstLogin = await request(app)
                .post('/api/login')
                .send({ email: 'notification-session@example.com', password: 'Secure123!' });
            const firstDashboard = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${firstLogin.body.token}`);
            const loggedOutDashboard = await request(app).get('/api/notifications');
            const storedDuringLogout = await Notification.findById(notification._id);
            const secondLogin = await request(app)
                .post('/api/login')
                .send({ email: 'notification-session@example.com', password: 'Secure123!' });
            const secondDashboard = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${secondLogin.body.token}`);

            expect(firstLogin.status).toBe(200);
            expect(firstDashboard.body.notifications).toHaveLength(1);
            expect(firstDashboard.body.notifications[0]._id).toBe(notification._id.toString());
            expect(loggedOutDashboard.status).toBe(401);
            expect(storedDuringLogout).not.toBeNull();
            expect(secondLogin.status).toBe(200);
            expect(secondDashboard.status).toBe(200);
            expect(secondDashboard.body.notifications).toHaveLength(1);
            expect(secondDashboard.body.notifications[0]).toMatchObject({
                _id: notification._id.toString(),
                recipient: userId,
                title: 'Persistent notification',
            });
        });

        it('keeps notifications consistent with application updates and saved job postings', async () => {
            const { recruiter, applicant, job, submission } = await createApplicationScenario();
            expect(submission.status).toBe(201);
            const applicationId = submission.body.application._id;

            const savedJob = await request(app)
                .post(`/api/jobs/${job._id}/favorite`)
                .set('test_user_id', applicant._id.toString());
            const savedJobs = await request(app)
                .get('/api/jobs/favorites')
                .set('test_user_id', applicant._id.toString());
            const update = await request(app)
                .patch(`/api/applications/${applicationId}/status`)
                .set('test_user_id', recruiter._id.toString())
                .send({ status: 'Under Review' });
            const myApplications = await request(app)
                .get('/api/applications/my')
                .set('test_user_id', applicant._id.toString());
            const dashboard = await request(app)
                .get('/api/notifications')
                .set('test_user_id', applicant._id.toString());
            const statusNotification = dashboard.body.notifications.find(
                (item) => item.title === 'Application Status Updated: Under Review'
            );

            expect(savedJob.status).toBe(200);
            expect(savedJob.body.savedJobIds).toContain(job._id.toString());
            expect(savedJobs.status).toBe(200);
            expect(savedJobs.body.map((saved) => saved._id)).toContain(job._id.toString());
            expect(update.status).toBe(200);
            expect(myApplications.status).toBe(200);
            expect(myApplications.body).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        _id: applicationId,
                        status: 'Under Review',
                    }),
                ])
            );
            expect(statusNotification).toMatchObject({
                recipient: applicant._id.toString(),
                type: 'APPLICATION_STATUS',
                relatedJob: job._id.toString(),
                relatedApplication: applicationId,
            });
            expect(dashboard.body.unreadCount).toBe(1);
        });
    });

    // 2. User Registration Tests
    describe('POST /api/register', () => {
        it('should register a new user successfully', async () => {
            const res = await request(app)
                .post('/api/register')
                .send({
                    email: 'test@example.com',
                    password: 'Secure123!',
                    confirmPassword: 'Secure123!'
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('message', 'User registered successfully!');
            expect(res.body.user).toHaveProperty('email', 'test@example.com');
            expect(res.body.user).toHaveProperty('role', 'job_seeker'); // Defaults when no role is chosen
            expect(res.body.user).not.toHaveProperty('password'); // Ensure hashed password isn't leaked
        });

        it('should register a new user with the recruiter role chosen at sign up', async () => {
            const res = await request(app)
                .post('/api/register')
                .send({
                    email: 'recruiter@example.com',
                    password: 'Secure123!',
                    confirmPassword: 'Secure123!',
                    role: 'recruiter'
                });

            expect(res.status).toBe(201);
            expect(res.body.user).toHaveProperty('role', 'recruiter');
        });

        it('should reject an invalid role at sign up', async () => {
            const res = await request(app)
                .post('/api/register')
                .send({
                    email: 'badrole@example.com',
                    password: 'Secure123!',
                    confirmPassword: 'Secure123!',
                    role: 'admin'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Invalid role');
        });

        it('should fail if email or password fields are missing', async () => {
            const res = await request(app)
                .post('/api/register')
                .send({ email: 'test@example.com' }); // missing password

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Email and password are required');
        });

        it('should fail if email is already taken', async () => {
            // Seed a user into our memory database first
            await request(app)
                .post('/api/register')
                .send({
                    email: 'duplicate@example.com',
                    password: 'Password123!',
                    confirmPassword: 'Password123!'
                });

            // Attempt to register identical email
            const res = await request(app)
                .post('/api/register')
                .send({
                    email: 'duplicate@example.com',
                    password: 'Different123!',
                    confirmPassword: 'Different123!'
                });

            expect(res.status).toBe(409);
            expect(res.body).toHaveProperty('error', 'Email already registered');
        });
    });

    // 3. Login Tests
    describe('POST /api/login', () => {
        beforeEach(async () => {
            // Create a default user profile to test logins against
            await request(app)
                .post('/api/register')
                .send({
                    email: 'loginme@example.com',
                    password: 'Correct123!',
                    confirmPassword: 'Correct123!'
                });
        });

        it('should return a JWT token on valid credentials', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({
                    email: 'loginme@example.com',
                    password: 'Correct123!'
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('message', 'Login successful!');
        });

        it('should reject invalid passwords with 401', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({ email: 'loginme@example.com', password: 'wrong_password' });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'Invalid email or password');
        });
    });

    // 4. Authenticated Profile Tests
    describe('GET /api/profile and PUT /api/profile', () => {
        let userId;

        beforeEach(async () => {
            // Create user profile directly via Mongoose model to secure a real system Object ID
            const user = await User.create({
                email: 'profileuser@example.com',
                password: 'password123',
                name: 'Jane Doe',
                role: 'job_seeker'
            });
            userId = user._id.toString();
        });

        it('should fetch the correct user profile when authenticated', async () => {
            const res = await request(app)
                .get('/api/profile')
                .set('test_user_id', userId); // Passes mock auth header verification

            expect(res.status).toBe(200);
            expect(res.body.user).toHaveProperty('email', 'profileuser@example.com');
            expect(res.body.user).toHaveProperty('name', 'Jane Doe');
        });

        it('should successfully update valid fields on PUT', async () => {
            const res = await request(app)
                .put('/api/profile')
                .set('test_user_id', userId)
                .send({
                    email: 'newemail@example.com',
                    name: 'Jane Smith',
                    role: 'recruiter',
                    location: 'Montreal',
                    bio: 'Experienced developer.'
                });

            expect(res.status).toBe(200);
            expect(res.body.user.email).toBe('newemail@example.com');
            expect(res.body.user.role).toBe('recruiter');
            expect(res.body.user.location).toBe('Montreal');
        });

        it('should reject invalid values (like wrong roles)', async () => {
            const res = await request(app)
                .put('/api/profile')
                .set('test_user_id', userId)
                .send({
                    email: 'profileuser@example.com',
                    role: 'invalid_role_type' // Must be job_seeker or recruiter
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Invalid role');
        });
    });
});
