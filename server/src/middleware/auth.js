const jwt = require("jsonwebtoken");

// Verifies the Bearer token issued by POST /api/login and attaches the
// authenticated user's id to req.user. Any route behind this middleware can
// trust req.user.id instead of accepting an id from the client directly.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.userId };
    next();
  } catch (err) {
    // Tokens last one hour (see POST /api/login). Telling an expired token
    // apart from a bad one lets the frontend ask the user to log in again.
    const error = err.name === "TokenExpiredError"
      ? "Your session has expired. Please log in again."
      : "Invalid token";
    return res.status(401).json({ error });
  }
}

module.exports = requireAuth;