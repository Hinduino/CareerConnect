const express = require("express");
const multer = require("multer");
const requireAuth = require("../middleware/auth");
const {
  findProfilePictureByUser,
  findProfilePictureMetaByUser,
  setProfilePicture,
  deleteProfilePictureByUser,
} = require("../queries/profilePictureQueries");

const router = express.Router();

// Same ownership model as resumeRoutes.js: req.user.id comes from the
// verified JWT, so a user can only ever view, upload, or delete their own
// profile picture.
router.use(requireAuth);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, GIF, and WEBP images are allowed"));
    }
    cb(null, true);
  },
});

function sanitizeFilename(name) {
  return name.replace(/[\r\n"]/g, "").trim() || "profile-picture";
}

function toPictureFields(file) {
  return {
    originalName: sanitizeFilename(file.originalname),
    contentType: file.mimetype,
    size: file.size,
    data: file.buffer,
  };
}

function toMetadata(picture, userId) {
  return {
    user: userId,
    originalName: picture.originalName,
    contentType: picture.contentType,
    size: picture.size,
  };
}

// GET /api/profile/picture -> the logged-in user's picture metadata.
router.get("/", async (req, res, next) => {
  try {
    const picture = await findProfilePictureMetaByUser(req.user.id);
    if (!picture) {
      return res.status(404).json({ error: "No profile picture found for this user" });
    }
    res.json(toMetadata(picture, req.user.id));
  } catch (err) {
    next(err);
  }
});

// GET /api/profile/picture/file -> the actual image bytes.
router.get("/file", async (req, res, next) => {
  try {
    const picture = await findProfilePictureByUser(req.user.id);
    if (!picture || !picture.data) {
      return res.status(404).json({ error: "No profile picture found for this user" });
    }

    res.set("Content-Type", picture.contentType);
    res.set("Cache-Control", "private, max-age=0, no-cache");
    res.send(picture.data);
  } catch (err) {
    next(err);
  }
});

// PUT /api/profile/picture -> upload a new picture or replace the existing one.
router.put("/", upload.single("picture"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded" });
    }

    const picture = await setProfilePicture(req.user.id, toPictureFields(req.file));
    if (!picture) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(toMetadata(picture, req.user.id));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/profile/picture -> remove the logged-in user's profile picture.
router.delete("/", async (req, res, next) => {
  try {
    const deleted = await deleteProfilePictureByUser(req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: "No profile picture found for this user" });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
