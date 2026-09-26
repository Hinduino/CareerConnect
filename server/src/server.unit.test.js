// server.unit.test.js
const request = require('supertest');
const express = require('express');
const app = require('../server'); // Import your express app instance

describe('CareerConnect Server API Tests', () => {

    // 1. Test Base Health Check
    describe('GET /', () => {
        it('should return 200 OK and a running message', async () => {
            const res = await request(app).get('/');
            
            expect(res.statusCode).toBe(200);
            expect(res.text).toBe('CareerConnect Server is running!');
        });
    });

    // 2. Test User Registration Mock API
    describe('POST /api/register', () => {
        it('should successfully register a user with valid email and password', async () => {
            const registrationData = {
                email: 'test@example.com',
                password: 'securePassword123'
            };

            const res = await request(app)
                .post('/api/register')
                .send(registrationData);

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('message', 'User registered successfully!');
            expect(res.body.user).toHaveProperty('email', 'test@example.com');
        });

        it('should return 400 Bad Request if email or password is missing', async () => {
            const incompleteData = {
                email: 'test@example.com'
                // password is missing deliberately
            };

            const res = await request(app)
                .post('/api/register')
                .send(incompleteData);

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error', 'Email and password are required');
        });
    });

    // 3. Test Global Error Handling Middleware
    describe('Error Handling Middleware', () => {
        it('should return 500 Internal Server Error when a route encounters an unhandled exception', async () => {
            // Suppress the console.error output during this test so it doesn't clutter your logs
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

            // Send broken/malformed JSON formatting to trigger your express JSON error handler
            const res = await request(app)
                .post('/api/register')
                .set('Content-Type', 'application/json')
                .send('{"email": "broken-malformed-json-payload'); 

            // Assertions
            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty('error', 'Internal Server Error');

            // Restore normal console behavior
            spy.mockRestore();
        });
    });

});
