module.exports = {
  // Global settings can go here
  projects: [
    {
      displayName: 'unit',
      testMatch: [
        '**/__tests__/**/*.[jt]s?(x)',
        '**/?(*.)+(spec|test).[jt]s?(x)'
      ],
      // Exclude the server integration directory from unit tests
      testPathIgnorePatterns: ['/node_modules/', '/server/tests/'],
    },
    {
      displayName: 'integration',
      // Only run files inside your server/tests folder
      testMatch: [
        '<rootDir>/tests/**/*.integration.test.js'
      ],
    }
  ]
};
