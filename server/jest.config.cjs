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
      collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!src/**/index.js',
        '!src/server.js',
        '!src/routes/chatRoutes.js',
        '!src/utils/documentText.js'
      ],
      coverageThreshold: {
        global: {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80
        },
        './src/routes/applicationRoutes.js': {
          branches: 70,
          functions: 90,
          lines: 80,
          statements: 80
        },
        './src/routes/jobRoutes.js': {
          branches: 75,
          functions: 90,
          lines: 80,
          statements: 80
        },
        './src/routes/resumeRoutes.js': {
          branches: 70,
          functions: 90,
          lines: 80,
          statements: 80
        },
        './src/routes/profilePictureRoutes.js': {
          branches: 90,
          functions: 100,
          lines: 90,
          statements: 90
        }
      }
    },
    {
      displayName: 'integration',
      // Only run files inside your server/tests folder
      testMatch: [
        '<rootDir>/tests/**/*.integration.test.js'
      ],
      collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!src/**/index.js',
        '!src/server.js',
        '!src/routes/chatRoutes.js',
        '!src/utils/documentText.js'
      ],
      coverageThreshold: {
        global: {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  ],
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json', 'json-summary']
};
