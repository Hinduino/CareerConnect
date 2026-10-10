const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Set up mandatory environment variables before importing the app
process.env.JWT_SECRET = 'test_secret_key_12345';
process.env.MONGO_URI = 'mongodb://localhost:27017/'; // Will be overridden

// Mock the authentication middleware so we can easily test protected routes
jest.mock('../src/middleware/auth', () => {
    return (req, res, next) => {
        // Look for a test header we pass during supertest calls
        if (req.headers.test_user_id) {
            req.user = { id: req.headers.test_user_id };
            return next();
        }
        return res.status(401).json({ error: 'Unauthorized' });
    };
});

// Import the app instance from server.js
const app = require('../src/server'); 
const User = require('../src/models/User');

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

    // 2. User Registration Tests
    describe('POST /api/register', () => {
        it('should register a new user successfully', async () => {
            const res = await request(app)
                .post('/api/register')
                .send({
                    email: 'test@example.com',
                    password: 'securepassword123'
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('message', 'User registered successfully!');
            expect(res.body.user).toHaveProperty('email', 'test@example.com');
            expect(res.body.user).not.toHaveProperty('password'); // Ensure hashed password isn't leaked
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
                .send({ email: 'duplicate@example.com', password: 'password123' });

            // Attempt to register identical email
            const res = await request(app)
                .post('/api/register')
                .send({ email: 'duplicate@example.com', password: 'differentpassword' });

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
                .send({ email: 'loginme@example.com', password: 'correct_password' });
        });

        it('should return a JWT token on valid credentials', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({ email: 'loginme@example.com', password: 'correct_password' });

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
