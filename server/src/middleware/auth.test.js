const jwt = require("jsonwebtoken");
const requireAuth = require("./auth");

process.env.JWT_SECRET = "test_secret_key_12345";

function mockResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function requestWith(token) {
  return { headers: { authorization: `Bearer ${token}` } };
}

describe("requireAuth middleware", () => {
  it("attaches the user id and continues for a valid token", () => {
    const token = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const req = requestWith(token);
    const res = mockResponse();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: "user-1" });
  });

  it("tells the user to log in again when the token has expired", () => {
    const token = jwt.sign(
      { userId: "user-1", exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET
    );
    const res = mockResponse();
    const next = jest.fn();

    requireAuth(requestWith(token), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Your session has expired. Please log in again." });
  });

  it("rejects a token signed with the wrong secret", () => {
    const token = jwt.sign({ userId: "user-1" }, "not-the-real-secret");
    const res = mockResponse();

    requireAuth(requestWith(token), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
  });

  it("rejects a request without a Bearer token", () => {
    const res = mockResponse();

    requireAuth({ headers: {} }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Missing or invalid authorization header" });
  });
});