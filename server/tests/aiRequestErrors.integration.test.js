const request = require("supertest");

process.env.JWT_SECRET = "test_secret_key_12345";
process.env.MONGO_URI = "mongodb://localhost:27017/";

const app = require("../src/server");

describe("AI endpoint request parsing errors", () => {
  it.each([
    "/api/resumes/507f1f77bcf86cd799439011/feedback",
    "/api/recommendations",
    "/api/chat"
  ])("returns a client error for invalid JSON on %s", async (path) => {
    const response = await request(app)
      .post(path)
      .set("Content-Type", "application/json")
      .send('{"messages":');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Request body must contain valid JSON.");
  });

  it("returns a payload-too-large response before an AI route runs", async () => {
    const response = await request(app)
      .post("/api/chat")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ messages: "x".repeat(110000) }));

    expect(response.status).toBe(413);
    expect(response.body.error).toBe("Request body is too large.");
  });
});
