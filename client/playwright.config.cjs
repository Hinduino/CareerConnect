const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/integration',
  fullyParallel: true,
  reporter: 'html',
  use: {
    // 1. Update the base URL to match Vite's default local port
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  /* Run your local dev server before starting the tests */
  webServer: {
    // 2. Change the command from 'npm run start' to 'npm run dev'
    command: 'npm run dev',
    // 3. Update the target URL to port 5173
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // Optional: 2-minute timeout safety cushion for CI environments
  },
});
