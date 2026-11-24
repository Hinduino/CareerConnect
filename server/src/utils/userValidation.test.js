const {
  normalizeEmail,
  isNonEmptyString,
  isValidEmail,
  isValidRole,
  getPasswordError,
  validateRegistration,
} = require("./userValidation");

describe("userValidation", () => {
  describe("isNonEmptyString", () => {
    it("accepts strings with visible characters", () => {
      expect(isNonEmptyString("hello")).toBe(true);
    });

    it.each(["", "   ", null, undefined, 42, {}])("rejects %p", (value) => {
      expect(isNonEmptyString(value)).toBe(false);
    });
  });

  describe("normalizeEmail", () => {
    it("trims and lowercases the address", () => {
      expect(normalizeEmail("  Foo@Example.COM  ")).toBe("foo@example.com");
    });

    it.each(["", "   ", null, undefined, 42])("returns null for %p", (value) => {
      expect(normalizeEmail(value)).toBeNull();
    });
  });

  describe("isValidEmail", () => {
    it.each(["user@example.com", "a.b@c.org"])("accepts %s", (email) => {
      expect(isValidEmail(email)).toBe(true);
    });

    it.each(["plainaddress", "no@tld", "spaces in@example.com", "@example.com"])(
      "rejects %s",
      (email) => {
        expect(isValidEmail(email)).toBe(false);
      }
    );
  });

  describe("isValidRole", () => {
    it.each(["job_seeker", "recruiter"])("accepts %s", (role) => {
      expect(isValidRole(role)).toBe(true);
    });

    it.each(["admin", "", null, undefined])("rejects %p", (role) => {
      expect(isValidRole(role)).toBe(false);
    });
  });

  describe("getPasswordError", () => {
    it("returns null for a password meeting every rule", () => {
      expect(getPasswordError("Secure123!")).toBeNull();
    });

    it.each([
      ["Sh0rt!", "Password must contain at least 8 characters"],
      ["secure123!", "Password must contain at least one uppercase letter"],
      ["SECURE123!", "Password must contain at least one lowercase letter"],
      ["SecurePass!", "Password must contain at least one number"],
      ["Secure12345", "Password must contain at least one special character"],
      ["Secure 123!", "Password must not contain spaces"],
    ])("flags %s with the first failing rule", (password, message) => {
      expect(getPasswordError(password)).toBe(message);
    });
  });

  describe("validateRegistration", () => {
    const valid = {
      email: "user@example.com",
      password: "Secure123!",
      confirmPassword: "Secure123!",
    };

    it("returns the normalized email and default role", () => {
      expect(validateRegistration({ ...valid, email: " User@Example.com " })).toEqual({
        email: "user@example.com",
        role: "job_seeker",
      });
    });

    it("keeps an explicitly chosen role", () => {
      expect(validateRegistration({ ...valid, role: "recruiter" })).toEqual({
        email: "user@example.com",
        role: "recruiter",
      });
    });

    it("works when called with no payload at all", () => {
      expect(validateRegistration()).toEqual({ error: "Email and password are required" });
    });

    it.each([
      [{ ...valid, email: undefined }, "Email and password are required"],
      [{ ...valid, password: undefined }, "Email and password are required"],
      [{ ...valid, email: "not-an-email" }, "Please enter a valid email address"],
      [{ ...valid, password: "weak", confirmPassword: "weak" }, "Password must contain at least 8 characters"],
      [{ ...valid, confirmPassword: undefined }, "Password confirmation is required"],
      [{ ...valid, confirmPassword: "Different123!" }, "Passwords do not match"],
      [{ ...valid, role: "admin" }, "Invalid role"],
    ])("rejects invalid input with the right message", (payload, error) => {
      expect(validateRegistration(payload)).toEqual({ error });
    });
  });
});
