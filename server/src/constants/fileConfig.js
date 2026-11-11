const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME_TYPES = {
  RESUME: new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  PROFILE_PICTURE: new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ]),
};

module.exports = {
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
};
