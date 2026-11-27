jest.mock("../models/User", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authRoutes = require("./authRoutes");

process.env.JWT_SECRET = "test-secret";

const app = express();
app.use(express.json());
app.use("/api", authRoutes);
// Mirrors the app's catch-all error handler so next(err) paths can be tested.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal Server Error" });
});

const storedUser = {
  _id: "507f1f77bcf86cd799439011",
  name: "Jane Doe",
  email: "jane@example.com",
  role: "job_seeker",
  location: "Montreal",
  bio: "Developer",
  password: bcrypt.hashSync("Correct123!", 4),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/register", () => {
  const payload = {
    email: "new@example.com",
    password: "Secure123!",
    confirmPassword: "Secure123!",
  };

  it("registers a user, storing a hashed password and normalized email", async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockImplementation(async (fields) => ({ _id: "new-id", ...fields }));

    const res = await request(app)
      .post("/api/register")
      .send({ ...payload, email: " New@Example.COM " });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("User registered successfully!");
    expect(res.body.user).toMatchObject({ email: "new@example.com", role: "job_seeker" });
    expect(res.body.user).not.toHaveProperty("password");

    const created = User.create.mock.calls[0][0];
    expect(created.email).toBe("new@example.com");
    expect(created.password).not.toBe(payload.password);
    expect(bcrypt.compareSync(payload.password, created.password)).toBe(true);
  });

  it("registers a recruiter when that role is chosen", async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockImplementation(async (fields) => ({ _id: "new-id", ...fields }));

    const res = await request(app)
      .post("/api/register")
      .send({ ...payload, role: "recruiter" });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("recruiter");
  });

  it("rejects an already registered email with 409", async () => {
    User.findOne.mockResolvedValue(storedUser);

    const res = await request(app).post("/api/register").send(payload);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Email already registered");
    expect(User.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ email: "new@example.com" }, "Email and password are required"],
    [{ ...payload, email: "bad-email" }, "Please enter a valid email address"],
    [{ ...payload, password: "weak", confirmPassword: "weak" }, "Password must contain at least 8 characters"],
    [{ ...payload, confirmPassword: "Other123!" }, "Passwords do not match"],
    [{ ...payload, role: "admin" }, "Invalid role"],
  ])("rejects invalid input with 400", async (body, error) => {
    const res = await request(app).post("/api/register").send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(error);
    expect(User.create).not.toHaveBeenCalled();
  });

  it("hands unexpected failures to the error handler", async () => {
    User.findOne.mockRejectedValue(new Error("db down"));

    const res = await request(app).post("/api/register").send(payload);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal Server Error");
  });
});

describe("POST /api/login", () => {
  it("returns a signed token and the user's profile on valid credentials", async () => {
    User.findOne.mockResolvedValue(storedUser);

    const res = await request(app)
      .post("/api/login")
      .send({ email: " Jane@Example.com ", password: "Correct123!" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Login successful!");
    expect(res.body.user).toMatchObject({ email: "jane@example.com" });
    expect(res.body.user).not.toHaveProperty("password");
    // The lookup uses the normalized email, so logins are case-insensitive.
    expect(User.findOne).toHaveBeenCalledWith({ email: { $eq: "jane@example.com" } });
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET).userId).toBe(storedUser._id);
  });

  it("rejects an unknown email with the same message as a bad password", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/login")
      .send({ email: "ghost@example.com", password: "Correct123!" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("rejects a wrong password with 401", async () => {
    User.findOne.mockResolvedValue(storedUser);

    const res = await request(app)
      .post("/api/login")
      .send({ email: "jane@example.com", password: "Wrong123!" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it.each([
    [{ password: "Correct123!" }],
    [{ email: "jane@example.com" }],
    [{ email: "   ", password: "Correct123!" }],
  ])("rejects missing credentials with 400", async (body) => {
    const res = await request(app).post("/api/login").send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Email and password are required");
  });

  it("hands unexpected failures to the error handler", async () => {
    User.findOne.mockRejectedValue(new Error("db down"));

    const res = await request(app)
      .post("/api/login")
      .send({ email: "jane@example.com", password: "Correct123!" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal Server Error");
  });
});

describe("POST /api/login without a JSON body", () => {
  it("rejects the login instead of crashing on the missing body", async () => {
    const res = await request(app).post("/api/login");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Email and password are required");
    expect(User.findOne).not.toHaveBeenCalled();
  });
});
