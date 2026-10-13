const User = require("../models/User");

// Restricts a route to users whose stored role is included in `roles`. Must
// run after requireAuth, since it relies on req.user.id being set from the
// verified JWT.
function requireRole(...roles) {
  return async function (req, res, next) {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action" });
    }

    req.user.role = user.role;
    next();
  };
}

module.exports = requireRole;
