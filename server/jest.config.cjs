module.exports = {
  testEnvironment: 'node',
  verbose: true,
  forceExit: true, // Useful if your app leaves open handles (like DB connections)
  clearMocks: true,
};
