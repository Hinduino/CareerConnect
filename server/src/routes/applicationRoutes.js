const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Application = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

// GET /api/applications/jobs/:jobId
// Allow recruiters to view applications for their own job postings.
router.get('/jobs/:jobId', requireAuth, requireRole('recruiter'), async (req, res) => {
    try {
        const { jobId } = req.params;

        // Validate the job posting ID.
        if (!mongoose.isValidObjectId(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID' });
        }

        // Verify that the job exists and belongs to this recruiter.
        const job = await JobPosting.findById(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.postedBy.toString() !== req.user.id) {
            return res.status(403).json({
                error: 'You can only view applications for your own postings'
            });
        }

        // Retrieve applications with safe applicant details.
        const applications = await Application.find({ job: jobId })
            .populate('applicant', 'name email location')
            .sort({ createdAt: 1, _id: 1 });

        return res.status(200).json(applications);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Server error fetching applications'
        });
    }
});

module.exports = router;