require("dotenv").config();
const connectDB = require("./config/db");
const { createUser, findUserByEmail } = require("./queries/userQueries");

const run = async () => {
  await connectDB();

  const newUser = await createUser({
    email: `test${Date.now()}@example.com`,
    password: "hashed_placeholder",
  });
  console.log("Created via query:", newUser);

  const found = await findUserByEmail(newUser.email);
  console.log("Found via query:", found);

  process.exit(0);
};

run();