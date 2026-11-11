const express = require("express");
const multer = require("multer");
const requireAuth = require("../middleware/auth");
const { MAX_FILE_SIZE, ALLOWED_MIME_TYPES } = require("../constants/fileConfig");
const { toPictureFields, toPictureMetadata } = require("../utils/fileUtils");
const {
  findProfilePictureByUser,
  findProfilePictureMetaByUser,
  setProfilePicture,
  deleteProfilePictureByUser,
} = require("../queries/profilePictureQueries");

const router = express.Router();

router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.PROFILE_PICTURE.has(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, GIF, and WEBP images are allowed"));
    }
    cb(null, true);
  },
});

router.get("/", async (req, res, next) => {
  try {
    const picture = await findProfilePictureMetaByUser(req.user.id);
    if (!picture) {
      return res.status(404).json({ error: "No profile picture found for this user" });
    }
    res.json(toPictureMetadata(picture, req.user.id));
  } catch (err) {
    next(err);
  }
});

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

router.put("/", upload.single("picture"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded" });
    }

    const picture = await setProfilePicture(req.user.id, toPictureFields(req.file));
    if (!picture) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(toPictureMetadata(picture, req.user.id));
  } catch (err) {
    next(err);
  }
});

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
