const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const extractDocumentText = require("../utils/documentText");
const { hasSupportedDocumentSignature } = require("../utils/documentFile");
const { MAX_FILE_SIZE, ALLOWED_MIME_TYPES } = require("../constants/fileConfig");
const { sanitizeFilename, toResumeFields, toResumeMetadata } = require("../utils/fileUtils");
const { generateResumeFeedback } = require("../services/resumeFeedbackService");
const {
  listResumesByUser,
  findResumeByIdForUser,
  createResume,
  replaceResumeById,
  deleteResumeById,
} = require("../queries/resumeQueries");

const router = express.Router();

router.use(requireAuth, requireRole("job_seeker"));

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

router.post("/:id/feedback", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid resume ID." });
  }

  let resume;
  try {
    resume = await findResumeByIdForUser(req.params.id, req.user.id);
  } catch {
    console.error("Failed to load the applicant's resume for feedback.");
    return res.status(500).json({ error: "Could not load this resume. Please try again." });
  }

  if (!resume || !resume.data) {
    return res.status(404).json({ error: "Resume not found." });
  }

  const file = {
    originalname: resume.originalName,
    mimetype: resume.contentType,
    buffer: resume.data
  };
  if (!hasSupportedDocumentSignature(file)) {
    return res.status(400).json({ error: "This resume is not a valid PDF, DOC, or DOCX document." });
  }

  let extracted;
  try {
    extracted = await extractDocumentText(file);
  } catch (error) {
    if (error.message === "No readable text was found in the document") {
      return res.status(400).json({ error: "No readable text was found in this resume." });
    }
    console.error("Failed to extract resume text for feedback.");
    return res.status(400).json({
      error: "Could not analyze this resume. Check that it is a valid PDF, DOC, or DOCX file."
    });
  }

  try {
    const feedback = await generateResumeFeedback(extracted);
    return res.json({ feedback });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

router.post("/", upload.single("resume"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded" });
    }
    if (!hasSupportedDocumentSignature(req.file)) {
      return res.status(400).json({
        error: "The file contents do not match a supported PDF, DOC, or DOCX document.",
      });
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
    if (!hasSupportedDocumentSignature(req.file)) {
      return res.status(400).json({
        error: "The file contents do not match a supported PDF, DOC, or DOCX document.",
      });
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