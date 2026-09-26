# AI Usage Log — Thanh Samdara Thach

Tool used: GitHub Copilot (agent mode, Claude Sonnet 5) in VS Code.

## Summary

Used GitHub Copilot to implement the resume upload/management feature (SCRUM-23) and to merge it with the user authentication feature (SCRUM-20) once the latter was ready, wiring the resume endpoints to require a valid login.

## Prompts and outcomes

1. **"Implement resume upload functionality. Only the base. The rest will be done by me"**
   - Requirements: store/link uploaded resumes to the corresponding user account; allow users to view, replace, and delete their uploaded resume.
   - AI explored the existing repo structure (models, server.js, client), asked clarifying questions about auth strategy and file storage, then implemented:
     - `models/Resume.js` — Mongoose schema storing resume binary data (`Buffer`), linked to `User` via a unique `user` field.
     - `routes/resumeRoutes.js` — REST endpoints for upload/view/replace/delete using `multer` (memory storage, 5MB limit, PDF/DOC/DOCX filter).
     - `server.js` — connected MongoDB, mounted the resume router, added Multer error handling.
     - Frontend: `client/src/api/resumeApi.js` and `client/src/components/ResumeManager.jsx`, wired into `App.jsx` with new styles.
   - AI ran end-to-end curl tests against a local MongoDB instance to verify upload, view, replace, delete, and error cases (duplicate upload, invalid file type, invalid id) before handing back.


2. **"pull changes from SCRUM-20: DEV - Implement login/sign-in and sign-up ... #12"**
   - AI fetched and merged `origin/feature/SCRUM-20-user-authentication` into the current branch, resolving conflicts in `server.js`, `package.json`, and `package-lock.json` by keeping both feature sets (resume routes + bcrypt/JWT auth) and reconciling dependency versions.
   - Verified the merge by running register/login/duplicate-email/wrong-password test cases against the live server before committing.


## Notes / limitations

- All AI-authored code was reviewed and tested against a local MongoDB instance before being accepted.
- Test users/resumes created during verification were deleted afterward; no test data was left in the shared database.
- No AI-generated code was pushed to `origin` without review; merge commits were made locally pending review.
