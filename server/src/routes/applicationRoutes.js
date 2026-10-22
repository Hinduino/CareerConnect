const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Application = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const { createApplication } = require('../queries/applicationQueries');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

// GET /api/applications/jobs/:jobId - Recruiters view applications for their posting
router.get('/jobs/:jobId', requireAuth, requireRole('recruiter'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.jobId)) {
            return res.status(400).json({ error: 'Invalid job ID' });
        }

        const job = await JobPosting.findById(req.params.jobId);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        if (job.postedBy.toString() !== req.user.id) {
            return res.status(403).json({ error: 'You can only view applications for your own job postings' });
        }

        const applications = await Application.find({ job: job._id })
            .sort({ createdAt: 1, _id: 1 })
            .populate('applicant', 'name email role');
        res.status(200).json(applications);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error fetching applications' });
    }
});

// POST /api/applications - Submit a new job application
router.post('/', async (req, res) => {
    try {
        const { jobId, applicantId } = req.body;
        // Note: If using auth middleware, replace applicantId with req.user.id

        if (!jobId || !applicantId) {
            return res.status(400).json({ error: 'Job ID and Applicant ID are required.' });
        }

        const application = await createApplication(applicantId, jobId);

        // Provide confirmation that the application has been submitted
        res.status(201).json({
            message: 'Application submitted successfully!',
            application
        });
    } catch (error) {
        console.error('Application Submission Error:', error);
        if (error.message === "You have already applied for this job.") {
             return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: 'Server error submitting application.' });
    }
});

module.exports = router;
