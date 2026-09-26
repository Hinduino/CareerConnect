const express = require("express");
const multer = require("multer");
const Resume = require("../models/Resume");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// ---------------------------------------------------------------------------
// All routes below require a valid JWT (see middleware/auth.js). The user is
// identified by req.user.id, which comes from the verified token - never
// from anything the client sends directly - so a user can only ever view,
// upload, replace, or delete their *own* resume.
// ---------------------------------------------------------------------------
router.use(requireAuth);

// Keep uploads reasonably small - resumes are text documents, not media,
// so 5MB is more than enough and keeps the database from bloating.
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
// This keeps everything in one place and avoids managing an uploads/ folder.
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

// Shapes what we send back to the client for metadata-only responses.
// Deliberately leaves out `data` (the raw file bytes) since that's only
// needed by the /file route - no point shipping megabytes of binary data
// every time someone just wants to know if a resume exists.
function toMetadata(resume) {
  return {
    id: resume._id,
    user: resume.user,
    originalName: resume.originalName,
    contentType: resume.contentType,
    size: resume.size,
    uploadedAt: resume.createdAt,
    updatedAt: resume.updatedAt,
  };
}

// GET /api/resumes -> the logged-in user's resume metadata (no binary data)
// Used by the frontend to check "does this user already have a resume" and
// to show details like the filename/size without downloading the whole file.
router.get("/", async (req, res, next) => {
  try {
    // .select("-data") excludes the file bytes at the DB query level, so we
    // never even pull the (potentially large) buffer into memory here.
    const resume = await Resume.findOne({ user: req.user.id }).select(
      "-data"
    );
    if (!resume) {
      return res.status(404).json({ error: "No resume found for this user" });
    }
    res.json(toMetadata(resume));
  } catch (err) {
    next(err);
  }
});

// GET /api/resumes/file -> actually stream back the resume bytes.
// Supports two modes via the response headers:
//   - default: "inline" so the browser can preview it in a new tab
//   - ?download=1: "attachment" so the browser triggers a Save As dialog
router.get("/file", async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ user: req.user.id });
    if (!resume) {
      return res.status(404).json({ error: "No resume found for this user" });
    }

    // encodeURIComponent handles spaces/unicode in filenames safely inside
    // the header value; the filename*=UTF-8'' form is the standard fallback
    // for browsers that need explicit UTF-8 filenames (RFC 5987).
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

// POST /api/resumes -> upload a brand new resume for the logged-in user.
// Deliberately rejects the request (409) if the user already has one on
// file - we want uploads and replacements to be explicit, separate actions
// so the frontend can't accidentally clobber an existing resume.
router.post(
  "/",
  upload.single("resume"), // parses the multipart form and populates req.file
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file was uploaded" });
      }

      const existing = await Resume.findOne({ user: req.user.id });
      if (existing) {
        return res.status(409).json({
          error: "A resume already exists for this user. Use PUT to replace it.",
        });
      }

      const resume = await Resume.create({
        user: req.user.id,
        originalName: sanitizeFilename(req.file.originalname),
        contentType: req.file.mimetype,
        size: req.file.size,
        data: req.file.buffer,
      });

      res.status(201).json(toMetadata(resume));
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/resumes -> swap out the logged-in user's current resume for a new
// file. Uses upsert so this also works as a "just create it" call if for
// some reason no resume existed yet - keeps the client logic simple (it can
// always PUT when it wants the "final" resume to exist, regardless of state).
router.put(
  "/",
  upload.single("resume"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file was uploaded" });
      }

      const resume = await Resume.findOneAndUpdate(
        { user: req.user.id },
        {
          user: req.user.id,
          originalName: sanitizeFilename(req.file.originalname),
          contentType: req.file.mimetype,
          size: req.file.size,
          data: req.file.buffer,
        },
        { new: true, upsert: true, runValidators: true }
      );

      res.status(200).json(toMetadata(resume));
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/resumes -> remove the logged-in user's resume entirely.
// Returns 204 (no body) on success, which is the conventional response for
// a DELETE that doesn't need to hand anything back.
router.delete("/", async (req, res, next) => {
  try {
    const resume = await Resume.findOneAndDelete({ user: req.user.id });
    if (!resume) {
      return res.status(404).json({ error: "No resume found for this user" });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
