const express = require('express');
const mongoose = require('mongoose');
const JobPosting = require('../models/JobPosting');
const Resume = require('../models/Resume');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const extractDocumentText = require('../utils/documentText');
const { hasSupportedDocumentSignature } = require('../utils/documentFile');
const { generateRecommendations } = require('../services/recommendationService');

const router = express.Router();
const MAX_CANDIDATE_JOBS = 5;

router.post('/', requireAuth, requireRole('job_seeker'), async (req, res) => {
    const requestBody = req.body ?? {};
    if (
        typeof requestBody !== 'object'
        || Array.isArray(requestBody)
        || Object.keys(requestBody).some((key) => key !== 'resumeId')
    ) {
        return res.status(400).json({ error: 'Invalid recommendation request.' });
    }
    const { resumeId } = requestBody;
    if (
        resumeId !== undefined
        && resumeId !== null
        && (typeof resumeId !== 'string' || !mongoose.isValidObjectId(resumeId))
    ) {
        return res.status(400).json({ error: 'Invalid resume ID.' });
    }

    const now = new Date();
    let profile;
    let resume;
    let candidateJobs;
    try {
        [profile, resume, candidateJobs] = await Promise.all([
            User.findById(req.user.id).select('location bio').lean(),
            resumeId
                ? Resume.findOne({ _id: resumeId, user: req.user.id })
                    .select('originalName contentType +data')
                : Promise.resolve(null),
            JobPosting.find({
                isArchived: { $ne: true },
                $or: [{ dueDate: null }, { dueDate: { $gt: now } }]
            })
                .select('title company location category description requirements dueDate createdAt')
                .sort({ createdAt: -1 })
                .limit(MAX_CANDIDATE_JOBS)
                .lean()
        ]);
    } catch {
        console.error('Failed to load job recommendation context.');
        return res.status(500).json({ error: 'Could not load recommendation data. Please try again.' });
    }

    if (resumeId && (!resume || !resume.data)) {
        return res.status(404).json({ error: 'Resume not found in your profile.' });
    }
    if (candidateJobs.length === 0) {
        return res.json({
            recommendations: [],
            message: 'There are no active job postings available right now.'
        });
    }

    let resumeContext = null;
    if (resume) {
        const resumeFile = {
            originalname: resume.originalName,
            mimetype: resume.contentType,
            buffer: resume.data
        };
        if (!hasSupportedDocumentSignature(resumeFile)) {
            return res.status(400).json({
                error: 'The selected resume is not a valid PDF, DOC, or DOCX document.'
            });
        }
        try {
            resumeContext = await extractDocumentText(resumeFile);
        } catch (error) {
            if (error.message === 'No readable text was found in the document') {
                return res.status(400).json({ error: 'No readable text was found in the selected resume.' });
            }
            console.error('Failed to extract resume for job recommendations.');
            return res.status(400).json({
                error: 'Could not analyze the selected resume. Check that it is a valid PDF, DOC, or DOCX file.'
            });
        }
    }

    if (!resumeContext && !profile?.bio?.trim() && !profile?.location?.trim()) {
        return res.json({
            recommendations: [],
            message: 'Add a profile summary or resume to get personalized job recommendations.'
        });
    }

    try {
        const result = await generateRecommendations({ profile, resumeContext, candidateJobs });
        return res.json(result);
    } catch (error) {
        return res.status(502).json({ error: error.message });
    }
});

module.exports = router;