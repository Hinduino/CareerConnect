const express = require("express");
const User = require("../models/User");
const requireAuth = require("../middleware/auth");
const { toProfile } = require("../utils/userProfile");
const { isNonEmptyString, normalizeEmail, isValidEmail, isValidRole } = require("../utils/userValidation");

const router = express.Router();

// Profile management: view and update the logged-in user's own profile.
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user: toProfile(user) });
  } catch (err) {
    next(err);
  }
});

router.put("/", async (req, res, next) => {
  try {
    const { name, email, role, location, bio } = req.body ?? {};

    if (!isNonEmptyString(email)) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Store the same normalized form registration uses, otherwise a user who
    // saves a mixed-case email could never log back in (login lowercases).
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }

    if (!isValidRole(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // String() + $eq keep the user-supplied value from ever acting as a
    // MongoDB query operator (it is already a validated string by here).
    const emailTaken = await User.findOne({
      email: { $eq: String(normalizedEmail) },
      _id: { $ne: req.user.id },
    });
    if (emailTaken) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name: String(name ?? ""),
        email: normalizedEmail,
        role,
        location: String(location ?? ""),
        bio: String(bio ?? ""),
      },
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Profile saved successfully!", user: toProfile(user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
