// Shared validation rules for account registration, login, and profile
// updates, kept in one place so the register and profile routes can't drift
// apart.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["job_seeker", "recruiter"];

// Every password rule with the message returned when it fails. Order matters:
// the first failing rule's message is shown to the user.
const PASSWORD_RULES = [
  {
    test: (password) => password.length >= 8,
    message: "Password must contain at least 8 characters",
  },
  {
    test: (password) => /[A-Z]/.test(password),
    message: "Password must contain at least one uppercase letter",
  },
  {
    test: (password) => /[a-z]/.test(password),
    message: "Password must contain at least one lowercase letter",
  },
  {
    test: (password) => /[0-9]/.test(password),
    message: "Password must contain at least one number",
  },
  {
    test: (password) => /[^A-Za-z0-9\s]/.test(password),
    message: "Password must contain at least one special character",
  },
  {
    test: (password) => !/\s/.test(password),
    message: "Password must not contain spaces",
  },
];

function isNonEmptyString(value) {
  return typeof value === "string" && Boolean(value.trim());
}

// Emails are stored lowercased so logins and uniqueness checks are
// case-insensitive. Returns null when the value isn't a usable string.
function normalizeEmail(email) {
  return isNonEmptyString(email) ? email.trim().toLowerCase() : null;
}

function isValidEmail(email) {
  return EMAIL_REGEX.test(email);
}

function isValidRole(role) {
  return VALID_ROLES.includes(role);
}

// The first unmet password rule's message, or null when the password passes.
function getPasswordError(password) {
  const failedRule = PASSWORD_RULES.find((rule) => !rule.test(password));
  return failedRule ? failedRule.message : null;
}

// Validates a registration payload in one pass. Returns `{ error }` for the
// first problem found, or `{ email, role }` with the normalized values to
// store when everything checks out.
function validateRegistration({ email, password, confirmPassword, role } = {}) {
  if (!isNonEmptyString(email) || typeof password !== "string" || !password) {
    return { error: "Email and password are required" };
  }

  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return { error: "Please enter a valid email address" };
  }

  const passwordError = getPasswordError(password);
  if (passwordError) {
    return { error: passwordError };
  }

  if (typeof confirmPassword !== "string" || !confirmPassword) {
    return { error: "Password confirmation is required" };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  // Role is chosen at sign up but can be changed later from the profile
  // settings page; an omitted role falls back to job seeker.
  const normalizedRole = typeof role === "string" ? role.trim() : "";
  if (normalizedRole && !isValidRole(normalizedRole)) {
    return { error: "Invalid role" };
  }

  return { email: normalizedEmail, role: normalizedRole || "job_seeker" };
}

module.exports = {
  VALID_ROLES,
  isNonEmptyString,
  normalizeEmail,
  isValidEmail,
  isValidRole,
  getPasswordError,
  validateRegistration,
};
