import { requestJson } from "./http";

export function registerUser(email, password, confirmPassword, role) {
  return requestJson("/register", {
    method: "POST",
    body: { email, password, confirmPassword, role },
    fallbackError: "Failed to register",
  });
}

export function loginUser(email, password) {
  return requestJson("/login", {
    method: "POST",
    body: { email, password },
    fallbackError: "Failed to log in",
  });
}

export function updateProfile(token, profile) {
  return requestJson("/profile", {
    method: "PUT",
    token,
    body: profile,
    fallbackError: "Failed to save profile",
  });
}

export function fetchProfile(token) {
  return requestJson("/profile", {
    token,
    fallbackError: "Failed to load profile",
  });
}
