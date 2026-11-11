const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Application = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const { sanitizeFilename } = require('../utils/fileUtils');
const {
  createApplication,
  cancelApplication,
  declineJobOffer,
  getApplicationStatus,
  getMyApplications,
  updateApplicationStatus,
} = require('../queries/applicationqueries');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

// ==========================================
// JOB SEEKER / APPLICANT ROUTES (SCRUM-309 & SCRUM-318)
// ==========================================

router.get('/history', requireAuth, requireRole('job_seeker'), async (req, res) => {
  try {
    const applications = await Application.find({ applicant: req.user.id })
      .populate('job', 'title company location description requirements category')
      .sort({ createdAt: -1 });

    res.status(200).json(applications);
  } catch (err) {
    console.error('Error fetching application history:', err);
    res.status(500).json({ error: 'Failed to fetch application history.' });
  }
});

router.patch('/:id/decline-offer', requireAuth, requireRole('job_seeker'), async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await declineJobOffer(id, req.user.id);
    res.status(200).json({ message: 'Offer declined successfully.', application: updated });
  } catch (err) {
    console.error('Error declining offer:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.get('/my', requireAuth, requireRole('job_seeker'), async (req, res) => {
  try {
    const applications = await getMyApplications(req.user.id);
    res.status(200).json(applications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching your applications' });
  }
});

router.get('/status/:jobId', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const status = await getApplicationStatus(req.user.id, req.params.jobId);
    res.status(200).json(status);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error checking application status' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { jobId, resumeId } = req.body;

    if (!jobId || !resumeId) {
      return res.status(400).json({ error: 'Job ID and resume are required.' });
    }

    const job = await JobPosting.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job posting not found.' });
    }
    if (job.isArchived) {
      return res.status(400).json({ error: 'This job posting is archived and no longer accepts applications.' });
    }

    const application = await createApplication(req.user.id, jobId, resumeId);

    res.status(201).json({
      message: 'Application submitted successfully!',
      application: {
        _id: application._id,
        job: application.job,
        applicant: application.applicant,
        status: application.status,
        createdAt: application.createdAt,
      },
    });
  } catch (error) {
    console.error('Application Submission Error:', error);
    if (error.message === 'You have already applied for this job.') {
      return res.status(409).json({ error: error.message });
    }
    if (
      error.message === 'Please select a resume to apply with.' ||
      error.message === 'Selected resume could not be found.'
    ) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Server error submitting application.' });
  }
});

router.delete('/:applicationId', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.applicationId)) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    await cancelApplication(req.user.id, req.params.applicationId);
    res.status(200).json({ message: 'Application cancelled successfully.' });
  } catch (error) {
    if (error.message === 'Application not found.') {
      return res.status(404).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Server error cancelling application.' });
  }
});

// ==========================================
// RECRUITER & RESUME ROUTES
// ==========================================

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
      .populate('applicant', 'name email role location');
    res.status(200).json(applications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching applications' });
  }
});

router.get('/:applicationId/resume', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.applicationId)) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    const application = await Application.findById(req.params.applicationId).select('+resume.data');
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const isApplicant = application.applicant.toString() === req.user.id;
    let isOwningRecruiter = false;
    if (!isApplicant) {
      const job = await JobPosting.findById(application.job);
      isOwningRecruiter = Boolean(job && job.postedBy.toString() === req.user.id);
    }

    if (!isApplicant && !isOwningRecruiter) {
      return res.status(403).json({ error: 'You do not have permission to access this resume' });
    }

    const { resume } = application;
    const safeName = encodeURIComponent(sanitizeFilename(resume.originalName));
    const disposition = req.query.download ? 'attachment' : 'inline';

    res.set('Content-Type', resume.contentType);
    res.set('Content-Disposition', `${disposition}; filename="${safeName}"`);
    res.send(resume.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching resume' });
  }
});

router.patch('/:applicationId/status', requireAuth, requireRole('recruiter'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.applicationId)) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    const { status } = req.body;

    const application = await updateApplicationStatus(
      req.user.id,
      req.params.applicationId,
      status
    );

    res.status(200).json({
      message: 'Application status updated successfully.',
      application: {
        _id: application._id,
        status: application.status,
        updatedAt: application.updatedAt,
      },
    });
  } catch (error) {
    if (error.message === 'Invalid application status.') {
      return res.status(400).json({ error: error.message });
    }

    if (error.message === 'Application not found.') {
      return res.status(404).json({ error: error.message });
    }

    if (error.message === 'Not authorized to update this application.') {
      return res.status(403).json({ error: error.message });
    }

    console.error(error);
    res.status(500).json({ error: 'Server error updating application status' });
  }
});

module.exports = router;
