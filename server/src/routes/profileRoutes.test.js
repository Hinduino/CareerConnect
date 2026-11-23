jest.mock("../middleware/auth", () => (req, res, next) => {
  req.user = { id: req.get("x-test-user-id") || "507f1f77bcf86cd799439011" };
  return next();
});
jest.mock("../models/User", () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const User = require("../models/User");
const profileRoutes = require("./profileRoutes");

const userId = "507f1f77bcf86cd799439011";
const storedUser = {
  _id: userId,
  name: "Jane Doe",
  email: "jane@example.com",
  role: "job_seeker",
  location: "Montreal",
  bio: "Developer",
  password: "hashed-secret",
};

const app = express();
app.use(express.json());
app.use("/api/profile", profileRoutes);
// Mirrors the app's catch-all error handler so next(err) paths can be tested.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal Server Error" });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/profile", () => {
  it("returns the logged-in user's safe profile fields", async () => {
    User.findById.mockResolvedValue(storedUser);

    const res = await request(app).get("/api/profile");

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: userId,
      name: "Jane Doe",
      email: "jane@example.com",
      role: "job_seeker",
      location: "Montreal",
      bio: "Developer",
      hasProfilePicture: false,
    });
    expect(User.findById).toHaveBeenCalledWith(userId);
  });

  it("returns 404 when the account no longer exists", async () => {
    User.findById.mockResolvedValue(null);

    const res = await request(app).get("/api/profile");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("User not found");
  });

  it("hands unexpected failures to the error handler", async () => {
    User.findById.mockRejectedValue(new Error("db down"));

    const res = await request(app).get("/api/profile");

    expect(res.status).toBe(500);
  });
});

describe("PUT /api/profile", () => {
  const payload = {
    name: "Jane Smith",
    email: "jane.smith@example.com",
    role: "recruiter",
    location: "Toronto",
    bio: "Recruiter now",
  };

  it("saves the profile and stores the email lowercased", async () => {
    User.findOne.mockResolvedValue(null);
    User.findByIdAndUpdate.mockImplementation(async (id, fields) => ({ _id: id, ...fields }));

    const res = await request(app)
      .put("/api/profile")
      .send({ ...payload, email: " Jane.Smith@Example.COM " });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Profile saved successfully!");
    expect(res.body.user).toMatchObject({
      email: "jane.smith@example.com",
      role: "recruiter",
      location: "Toronto",
    });
    // The uniqueness check must exclude the user's own account.
    expect(User.findOne).toHaveBeenCalledWith({
      email: "jane.smith@example.com",
      _id: { $ne: userId },
    });
  });

  it("defaults optional fields to empty strings", async () => {
    User.findOne.mockResolvedValue(null);
    User.findByIdAndUpdate.mockImplementation(async (id, fields) => ({ _id: id, ...fields }));

    const res = await request(app)
      .put("/api/profile")
      .send({ email: payload.email, role: "job_seeker" });

    expect(res.status).toBe(200);
    expect(User.findByIdAndUpdate.mock.calls[0][1]).toMatchObject({
      name: "",
      location: "",
      bio: "",
    });
  });

  it.each([
    [{ ...payload, email: undefined }, "Email is required"],
    [{ ...payload, email: "   " }, "Email is required"],
    [{ ...payload, email: "not-an-email" }, "Please enter a valid email address"],
    [{ ...payload, role: "admin" }, "Invalid role"],
    [{ ...payload, role: undefined }, "Invalid role"],
  ])("rejects invalid input with 400", async (body, error) => {
    const res = await request(app).put("/api/profile").send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(error);
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects an email that belongs to another account with 409", async () => {
    User.findOne.mockResolvedValue({ _id: "someone-else" });

    const res = await request(app).put("/api/profile").send(payload);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Email already registered");
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when the account no longer exists", async () => {
    User.findOne.mockResolvedValue(null);
    User.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app).put("/api/profile").send(payload);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("User not found");
  });

  it("hands unexpected failures to the error handler", async () => {
    User.findOne.mockRejectedValue(new Error("db down"));

    const res = await request(app).put("/api/profile").send(payload);

    expect(res.status).toBe(500);
  });
});
