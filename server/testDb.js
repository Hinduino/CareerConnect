require("dotenv").config();
const connectDB = require("./config/db");
const User = require("./models/User");

const run = async () => {
  await connectDB();

  const testUser = await User.create({
    email: `test${Date.now()}@example.com`,
    password: "hashed_placeholder",
  });
  console.log("Created:", testUser);

  const found = await User.findById(testUser._id);
  console.log("Found:", found);

  process.exit(0);
};

run();