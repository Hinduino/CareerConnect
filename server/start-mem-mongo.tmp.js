const { MongoMemoryServer } = require('mongodb-memory-server');
(async () => {
  const mongod = await MongoMemoryServer.create();
  console.log('MONGO_URI=' + mongod.getUri());
  process.on('SIGTERM', async () => { await mongod.stop(); process.exit(0); });
})();
