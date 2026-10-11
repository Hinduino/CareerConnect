const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_secret_key_12345";
process.env.MONGO_URI = "mongodb://localhost:27017/";

jest.mock("../src/middleware/auth", () => (req, res, next) => {
  if (!req.headers.test_user_id) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.user = { id: req.headers.test_user_id };
  next();
});

const app = require("../src/server");
const User = require("../src/models/User");

let mongoServer;

function parseBuffer(response, callback) {
  const chunks = [];
  response.on("data", (chunk) => chunks.push(chunk));
  response.on("end", () => callback(null, Buffer.concat(chunks)));
}

async function createUser(email = "pictureuser@example.com") {
  const user = await User.create({ email, password: "password123", name: "Jane Doe" });
  return user._id.toString();
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.disconnect();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany();
  }
});

describe("Profile picture integration tests", () => {
  it("requires authentication for all profile picture routes", async () => {
    const metadata = await request(app).get("/api/profile/picture");
    const file = await request(app).get("/api/profile/picture/file");
    const upload = await request(app).put("/api/profile/picture");
    const deletion = await request(app).delete("/api/profile/picture");

    expect(metadata.status).toBe(401);
    expect(file.status).toBe(401);
    expect(upload.status).toBe(401);
    expect(deletion.status).toBe(401);
  });

  it("returns 404 when the user has no profile picture", async () => {
    const userId = await createUser();

    const metadata = await request(app)
      .get("/api/profile/picture")
      .set("test_user_id", userId);
    const file = await request(app)
      .get("/api/profile/picture/file")
      .set("test_user_id", userId);

    expect(metadata.status).toBe(404);
    expect(metadata.body).toEqual({ error: "No profile picture found for this user" });
    expect(file.status).toBe(404);
  });

  it("uploads a picture, stores its bytes, and returns sanitized metadata", async () => {
    const userId = await createUser();
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);

    const upload = await request(app)
      .put("/api/profile/picture")
      .set("test_user_id", userId)
      .attach("picture", image, { filename: 'avatar".png', contentType: "image/png" });

    expect(upload.status).toBe(200);
    expect(upload.body).toEqual({
      user: userId,
      originalName: "avatar.png",
      contentType: "image/png",
      size: image.length,
    });
    expect(upload.body).not.toHaveProperty("data");

    const storedUser = await User.findById(userId).select("+profilePicture.data");
    expect(Buffer.from(storedUser.profilePicture.data)).toEqual(image);

    const profile = await request(app)
      .get("/api/profile")
      .set("test_user_id", userId);
    expect(profile.body.user.hasProfilePicture).toBe(true);
  });

  it("returns metadata without bytes and serves the uploaded image", async () => {
    const userId = await createUser();
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
    await request(app)
      .put("/api/profile/picture")
      .set("test_user_id", userId)
      .attach("picture", image, { filename: "avatar.png", contentType: "image/png" });

    const metadata = await request(app)
      .get("/api/profile/picture")
      .set("test_user_id", userId);
    const file = await request(app)
      .get("/api/profile/picture/file")
      .set("test_user_id", userId)
      .buffer(true)
      .parse(parseBuffer);

    expect(metadata.status).toBe(200);
    expect(metadata.body).toEqual({
      user: userId,
      originalName: "avatar.png",
      contentType: "image/png",
      size: image.length,
    });
    expect(metadata.body).not.toHaveProperty("data");
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toMatch(/^image\/png/);
    expect(file.headers["cache-control"]).toBe("private, max-age=0, no-cache");
    expect(file.body).toEqual(image);
  });

  it("replaces an existing picture", async () => {
    const userId = await createUser();
    const firstImage = Buffer.from("first");
    const replacement = Buffer.from("replacement");
    await request(app)
      .put("/api/profile/picture")
      .set("test_user_id", userId)
      .attach("picture", firstImage, { filename: "first.jpg", contentType: "image/jpeg" });

    const response = await request(app)
      .put("/api/profile/picture")
      .set("test_user_id", userId)
      .attach("picture", replacement, { filename: "new.webp", contentType: "image/webp" });

    expect(response.status).toBe(200);
    expect(response.body.originalName).toBe("new.webp");
    expect(response.body.contentType).toBe("image/webp");
    expect(response.body.size).toBe(replacement.length);

    const storedUser = await User.findById(userId).select("+profilePicture.data");
    expect(Buffer.from(storedUser.profilePicture.data)).toEqual(replacement);
  });

  it("rejects unsupported files and requests without a file", async () => {
    const userId = await createUser();
    const unsupported = await request(app)
      .put("/api/profile/picture")
      .set("test_user_id", userId)
      .attach("picture", Buffer.from("not an image"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });
    const missing = await request(app)
      .put("/api/profile/picture")
      .set("test_user_id", userId)
      .field("description", "no picture attached");

    expect(unsupported.status).toBe(400);
    expect(unsupported.body.error).toBe("Only JPG, PNG, GIF, and WEBP images are allowed");
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe("No file was uploaded");
  });

  it("rejects files larger than 5MB", async () => {
    const userId = await createUser();
    const response = await request(app)
      .put("/api/profile/picture")
      .set("test_user_id", userId)
      .attach("picture", Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: "large.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("File is too large. Maximum size is 5MB.");
  });

  it("returns 404 for an unknown user and deletes an existing picture", async () => {
    const missingUserId = new mongoose.Types.ObjectId().toString();
    const missingUserUpload = await request(app)
      .put("/api/profile/picture")
      .set("test_user_id", missingUserId)
      .attach("picture", Buffer.from("image"), {
        filename: "avatar.gif",
        contentType: "image/gif",
      });
    expect(missingUserUpload.status).toBe(404);
    expect(missingUserUpload.body.error).toBe("User not found");

    const userId = await createUser();
    await request(app)
      .put("/api/profile/picture")
      .set("test_user_id", userId)
      .attach("picture", Buffer.from("image"), {
        filename: "avatar.gif",
        contentType: "image/gif",
      });

    const deletion = await request(app)
      .delete("/api/profile/picture")
      .set("test_user_id", userId);
    const repeatDeletion = await request(app)
      .delete("/api/profile/picture")
      .set("test_user_id", userId);
    const profile = await request(app)
      .get("/api/profile")
      .set("test_user_id", userId);

    expect(deletion.status).toBe(204);
    expect(repeatDeletion.status).toBe(404);
    expect(profile.body.user.hasProfilePicture).toBe(false);
  });
});
