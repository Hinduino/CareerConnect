const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const requireAuth = require("../middleware/auth");
const { MAX_FILE_SIZE, ALLOWED_MIME_TYPES } = require("../constants/fileConfig");
const { sanitizeFilename, toResumeFields, toResumeMetadata } = require("../utils/fileUtils");
const {
  listResumesByUser,
  findResumeByIdForUser,
  createResume,
  replaceResumeById,
  deleteResumeById,
} = require("../queries/resumeQueries");

const router = express.Router();

router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.RESUME.has(file.mimetype)) {
      return cb(new Error("Only PDF, DOC, and DOCX files are allowed"));
    }
    cb(null, true);
  },
});

router.get("/", async (req, res, next) => {
  try {
    const resumes = await listResumesByUser(req.user.id);
    res.json(resumes.map(toResumeMetadata));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/file", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid resume ID" });
    }

    const resume = await findResumeByIdForUser(req.params.id, req.user.id);
    if (!resume || !resume.data) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const safeName = encodeURIComponent(sanitizeFilename(resume.originalName));
    const disposition = req.query.download ? "attachment" : "inline";

    res.set("Content-Type", resume.contentType);
    res.set(
      "Content-Disposition",
      `${disposition}; filename="${safeName}"; filename*=UTF-8''${safeName}`
    );
    res.send(resume.data);
  } catch (err) {
    next(err);
  }
});

router.post("/", upload.single("resume"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded" });
    }

    const resume = await createResume(req.user.id, toResumeFields(req.file));
    res.status(201).json(toResumeMetadata(resume));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", upload.single("resume"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid resume ID" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded" });
    }

    const resume = await replaceResumeById(req.params.id, req.user.id, toResumeFields(req.file));
    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }
    res.status(200).json(toResumeMetadata(resume));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid resume ID" });
    }

    const deleted = await deleteResumeById(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: "Resume not found" });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
