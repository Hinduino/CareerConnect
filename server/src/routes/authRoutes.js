const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { toProfile } = require("../utils/userProfile");
const { isNonEmptyString, normalizeEmail, validateRegistration } = require("../utils/userValidation");

const router = express.Router();

const BCRYPT_SALT_ROUNDS = 10;
// Sessions are stateless JWTs; expiry is the only thing that ends them, so
// keep it short. The auth middleware surfaces a friendly message on expiry.
const TOKEN_LIFETIME = "1h";

// Sprint 1 Feature: User Registration
router.post("/register", async (req, res, next) => {
  try {
    const validation = validateRegistration(req.body);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const existingUser = await User.findOne({ email: validation.email });
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash the password before storing it; the plain text is never saved.
    const hashedPassword = await bcrypt.hash(req.body.password, BCRYPT_SALT_ROUNDS);

    const newUser = await User.create({
      email: validation.email,
      password: hashedPassword,
      role: validation.role,
    });

    res.status(201).json({
      message: "User registered successfully!",
      user: toProfile(newUser),
    });
  } catch (err) {
    next(err);
  }
});

// Sprint 1 Feature: User Login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!isNonEmptyString(email) || typeof password !== "string" || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });

    // One shared message for "no such account" and "wrong password" so the
    // endpoint can't be used to probe which emails are registered.
    const passwordMatch = user ? await bcrypt.compare(password, user.password) : false;
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_LIFETIME }
    );

    res.status(200).json({
      message: "Login successful!",
      token,
      user: toProfile(user),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
