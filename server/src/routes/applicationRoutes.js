const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Application = require('../models/Application');
const { APPLICATION_STATUSES } = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

// Job fields shown alongside an application, so the job seeker can see
// which posting each application belongs to (SCRUM-166).
const JOB_SUMMARY_FIELDS = 'title company location category';

// POST /api/applications
// A job seeker applies to a job posting. The new application starts as
// "Applied", with one matching entry in its status history.
router.post('/', requireAuth, requireRole('job_seeker'), async (req, res) => {
    try {
        const { jobId } = req.body;

        if (!mongoose.isValidObjectId(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID' });
        }

        const job = await JobPosting.findById(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const application = await Application.create({
            applicant: req.user.id,
            job: jobId,
        });

        await application.populate('job', JOB_SUMMARY_FIELDS);
        return res.status(201).json(application);
    } catch (error) {
        // 11000 is MongoDB's duplicate key error, raised by the unique
        // applicant + job index when the user has already applied.
        if (error.code === 11000) {
            return res.status(409).json({ error: 'You have already applied to this job' });
        }
        console.error(error);
        return res.status(500).json({ error: 'Server error submitting application' });
    }
});

// GET /api/applications/mine
// The logged-in job seeker's applications, newest first, with the current
// status, the status history, and a summary of each job.
router.get('/mine', requireAuth, requireRole('job_seeker'), async (req, res) => {
    try {
        const applications = await Application.find({ applicant: req.user.id })
            .populate('job', JOB_SUMMARY_FIELDS)
            .sort({ createdAt: -1 });

        return res.status(200).json(applications);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error fetching your applications' });
    }
});

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

// PATCH /api/applications/:id/status
// The recruiter who owns the job moves an application to a new status.
// Both the current status and the status history are updated together.
router.patch('/:id/status', requireAuth, requireRole('recruiter'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid application ID' });
        }

        if (!APPLICATION_STATUSES.includes(status)) {
            return res.status(400).json({
                error: `Status must be one of: ${APPLICATION_STATUSES.join(', ')}`
            });
        }

        const application = await Application.findById(id).populate('job', 'postedBy');
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // The job may have been deleted, or created before postings had an owner.
        if (!application.job || !application.job.postedBy
            || application.job.postedBy.toString() !== req.user.id) {
            return res.status(403).json({
                error: 'You can only update applications for your own postings'
            });
        }

        // Skip duplicate history entries when nothing actually changes.
        if (application.status === status) {
            return res.status(400).json({ error: `Application is already ${status}` });
        }

        application.status = status;
        application.statusHistory.push({ status, changedAt: new Date() });
        await application.save();

        await application.populate('job', JOB_SUMMARY_FIELDS);
        return res.status(200).json(application);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error updating application status' });
    }
});

module.exports = router;