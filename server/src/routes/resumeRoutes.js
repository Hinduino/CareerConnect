const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const requireAuth = require("../middleware/auth");
const {
  listResumesByUser,
  findResumeByIdForUser,
  createResume,
  replaceResumeById,
  deleteResumeById,
} = require("../queries/resumeQueries");

const router = express.Router();

// ---------------------------------------------------------------------------
// All routes below require a valid JWT (see middleware/auth.js). The user is
// identified by req.user.id, which comes from the verified token - never
// from anything the client sends directly - so a user can only ever view,
// upload, or delete their *own* resumes.
//
// Each applicant can save more than one resume (see models/Resume.js) and
// picks which one to attach when applying for a job.
// ---------------------------------------------------------------------------
router.use(requireAuth);

// Keep uploads reasonably small - resumes are text documents, not media.
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Only accept the file types a resume would realistically be in. This is
// checked against the MIME type the browser reports, so it's a first line
// of defense rather than a bulletproof guarantee (a bad actor could spoof
// the mimetype), but it blocks accidental/careless uploads.
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// We use memoryStorage() instead of disk storage because resumes are stored
// directly in MongoDB (as a Buffer) rather than on the server's filesystem.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Only PDF, DOC, and DOCX files are allowed"));
    }
    cb(null, true);
  },
});

// Filenames come straight from the uploader's browser, so we can't fully
// trust them. Stripping quotes/newlines stops someone from injecting extra
// headers via a crafted filename when we echo it back in Content-Disposition.
function sanitizeFilename(name) {
  return name.replace(/[\r\n"]/g, "").trim() || "resume";
}

// Turns the multer file into the shape the query functions expect.
function toResumeFields(file) {
  return {
    originalName: sanitizeFilename(file.originalname),
    contentType: file.mimetype,
    size: file.size,
    data: file.buffer,
  };
}

// Shapes what we send back to the client for metadata-only responses.
// Deliberately leaves out `data` (the raw file bytes).
function toMetadata(resume) {
  return {
    id: resume._id,
    originalName: resume.originalName,
    contentType: resume.contentType,
    size: resume.size,
    createdAt: resume.createdAt,
  };
}

// GET /api/resumes -> the logged-in user's saved resumes (no binary data)
router.get("/", async (req, res, next) => {
  try {
    const resumes = await listResumesByUser(req.user.id);
    res.json(resumes.map(toMetadata));
  } catch (err) {
    next(err);
  }
});

// GET /api/resumes/:id/file -> actually send back one resume's bytes.
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

// POST /api/resumes -> upload a new resume for the logged-in user. Users may
// have any number of saved resumes.
router.post("/", upload.single("resume"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded" });
    }

    const resume = await createResume(req.user.id, toResumeFields(req.file));
    res.status(201).json(toMetadata(resume));
  } catch (err) {
    next(err);
  }
});

// PUT /api/resumes/:id -> replace the file for one of the logged-in user's
// existing resumes, keeping its id. Applications keep a snapshot taken at
// submission time, so this has no effect on resumes already attached to one.
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
    res.status(200).json(toMetadata(resume));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/resumes/:id -> remove one of the logged-in user's resumes.
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
