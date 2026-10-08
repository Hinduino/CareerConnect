const express = require("express");
const multer = require("multer");
const requireAuth = require("../middleware/auth");
const {
  findResumeByUser,
  findResumeMetaByUser,
  createResume,
  replaceResume,
  deleteResumeByUser,
} = require("../queries/resumeQueries");

const router = express.Router();

// ---------------------------------------------------------------------------
// All routes below require a valid JWT (see middleware/auth.js). The user is
// identified by req.user.id, which comes from the verified token - never
// from anything the client sends directly - so a user can only ever view,
// upload, replace, or delete their *own* resume.
//
// The resume is stored inside that user's document (the embedded `resume`
// field on User), so every route here reads or updates the user document.
// ---------------------------------------------------------------------------
router.use(requireAuth);

// Keep uploads reasonably small - resumes are text documents, not media.
// This matters more now that the file lives inside the user document:
// MongoDB caps a single document at 16MB, and 5MB stays well under that.
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
// Deliberately leaves out `data` (the raw file bytes) since that's only
// needed by the /file route. There is no resume `id` anymore: an embedded
// resume is identified by the user it belongs to.
function toMetadata(resume, userId) {
  return {
    user: userId,
    originalName: resume.originalName,
    contentType: resume.contentType,
    size: resume.size,
    uploadedAt: resume.uploadedAt,
    updatedAt: resume.updatedAt,
  };
}

// GET /api/resumes -> the logged-in user's resume metadata (no binary data)
router.get("/", async (req, res, next) => {
  try {
    const resume = await findResumeMetaByUser(req.user.id);
    if (!resume) {
      return res.status(404).json({ error: "No resume found for this user" });
    }
    res.json(toMetadata(resume, req.user.id));
  } catch (err) {
    next(err);
  }
});

// GET /api/resumes/file -> actually send back the resume bytes.
router.get("/file", async (req, res, next) => {
  try {
    const resume = await findResumeByUser(req.user.id);
    if (!resume || !resume.data) {
      return res.status(404).json({ error: "No resume found for this user" });
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

// POST /api/resumes -> upload a brand new resume for the logged-in user.
router.post("/", upload.single("resume"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded" });
    }

    // createResume only writes when the user has no resume yet, so a null
    // result means one is already there.
    const resume = await createResume(req.user.id, toResumeFields(req.file));
    if (!resume) {
      return res.status(409).json({
        error: "A resume already exists for this user. Use PUT to replace it.",
      });
    }

    res.status(201).json(toMetadata(resume, req.user.id));
  } catch (err) {
    next(err);
  }
});

// PUT /api/resumes -> swap out the logged-in user's current resume for a new file.
router.put("/", upload.single("resume"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded" });
    }

    const resume = await replaceResume(req.user.id, toResumeFields(req.file));
    if (!resume) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(toMetadata(resume, req.user.id));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/resumes -> remove the logged-in user's resume entirely.
router.delete("/", async (req, res, next) => {
  try {
    const deleted = await deleteResumeByUser(req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: "No resume found for this user" });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;