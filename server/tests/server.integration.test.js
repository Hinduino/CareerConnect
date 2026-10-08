const request = require('supertest');

describe('Server Integration Tests (Existing server.js)', () => {
  let serverInstance;

  beforeAll(() => {
    // 1. Assign a unique port for testing to avoid EADDRINUSE conflicts
    process.env.PORT = 5001; 
    
    // 2. Import the file, which instantly boots up the server on port 5001
    serverInstance = require('../src/server');
  });

  afterAll(async () => {
    // 3. CRITICAL: Close the network connection so Jest can exit cleanly
    await new Promise((resolve) => serverInstance.close(resolve));
  });

  it('GET /api/v1/health should respond with a 200 status', async () => {
    // Pass the running server instance directly to supertest
    const response = await request(serverInstance)
      .get('/api/v1/health')
      .expect('Content-Type', /json/)
      .expect(200);

    // Swap 'healthy' with whatever your actual existing route returns
    expect(response.body).toHaveProperty('status'); 
  });
});
