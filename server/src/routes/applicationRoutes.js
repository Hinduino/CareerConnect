const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Application = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const User = require('../models/User');
const { toProfile } = require('../utils/userProfile');
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
const { createNotificationSafe } = require('../queries/notificationQueries');

const OBJECT_ID_HEX_PATTERN = /^[0-9a-fA-F]{24}$/;

function parseValidObjectIdString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!OBJECT_ID_HEX_PATTERN.test(trimmed) || !mongoose.isValidObjectId(trimmed)) {
    return null;
  }
  return new mongoose.Types.ObjectId(trimmed).toHexString();
}

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
    const id = parseValidObjectIdString(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    const updated = await declineJobOffer(id, req.user.id);
    const job = await JobPosting.findById(updated.job);
    if (job && job.postedBy) {
      await createNotificationSafe({
        recipient: job.postedBy,
        type: 'APPLICATION_STATUS',
        title: 'Job Offer Declined',
        message: `A candidate declined the offer for "${job.title}" at ${job.company}.`,
        relatedJob: job._id,
        relatedApplication: updated._id,
      });
    }

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
    const jobId = parseValidObjectIdString(req.params.jobId);
    if (!jobId) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const status = await getApplicationStatus(req.user.id, jobId);
    res.status(200).json(status);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error checking application status' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const rawJobId = typeof req.body?.jobId === 'string' ? req.body.jobId.trim() : '';
    const rawResumeId = typeof req.body?.resumeId === 'string' ? req.body.resumeId.trim() : '';

    if (!rawJobId || !rawResumeId) {
      return res.status(400).json({ error: 'Job ID and resume are required.' });
    }

    const jobId = parseValidObjectIdString(rawJobId);
    if (!jobId) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const resumeId = parseValidObjectIdString(rawResumeId);
    if (!resumeId) {
      return res.status(400).json({ error: 'Selected resume could not be found.' });
    }

    const job = await JobPosting.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job posting not found.' });
    }
    if (job.isArchived) {
      return res.status(400).json({ error: 'This job posting is archived and no longer accepts applications.' });
    }
    if (job.dueDate && job.dueDate <= new Date()) {
      return res.status(400).json({ error: 'This job posting has expired and no longer accepts applications.' });
    }

    const application = await createApplication(req.user.id, jobId, resumeId);

    if (job.postedBy) {
      await createNotificationSafe({
        recipient: job.postedBy,
        type: 'APPLICATION_SUBMITTED',
        title: 'New Application Received',
        message: `A candidate applied for "${job.title}" at ${job.company}.`,
        relatedJob: job._id,
        relatedApplication: application._id,
      });
    }

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
    const applicationId = parseValidObjectIdString(req.params.applicationId);
    if (!applicationId) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    const existingApplication = await Application.findOne({
      _id: applicationId,
      applicant: req.user.id,
    });

    await cancelApplication(req.user.id, applicationId);

    if (existingApplication) {
      const job = await JobPosting.findById(existingApplication.job).select('title company postedBy');
      if (job && job.postedBy) {
        await createNotificationSafe({
          recipient: job.postedBy,
          type: 'APPLICATION_WITHDRAWN',
          title: 'Application Withdrawn',
          message: `A candidate withdrew their application for "${job.title}" at ${job.company}.`,
          relatedJob: job._id,
          relatedApplication: existingApplication._id,
        });
      }
    }

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
    const jobId = parseValidObjectIdString(req.params.jobId);
    if (!jobId) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const job = await JobPosting.findById(jobId);
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

router.get('/:applicationId/applicant', requireAuth, requireRole('recruiter'), async (req, res) => {
  try {
    const applicationId = parseValidObjectIdString(req.params.applicationId);
    if (!applicationId) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const job = await JobPosting.findById(application.job);
    if (!job || job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You can only view applicants for your own job postings' });
    }

    const applicant = await User.findById(application.applicant);
    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    const resume = application.resume && application.resume.originalName
      ? {
          originalName: application.resume.originalName,
          contentType: application.resume.contentType,
          size: application.resume.size,
        }
      : null;

    res.status(200).json({
      applicant: toProfile(applicant),
      resume,
      application: {
        _id: application._id,
        status: application.status,
        createdAt: application.createdAt,
        job: { _id: job._id, title: job.title, company: job.company },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching applicant profile' });
  }
});

router.get('/:applicationId/resume', requireAuth, async (req, res) => {
  try {
    const applicationId = parseValidObjectIdString(req.params.applicationId);
    if (!applicationId) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    const application = await Application.findById(applicationId).select('+resume.data');
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
    const applicationId = parseValidObjectIdString(req.params.applicationId);
    if (!applicationId) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    const { status, interviewDate } = req.body;

    const application = await updateApplicationStatus(
      req.user.id,
      applicationId,
      status,
      interviewDate
    );

    const job = await JobPosting.findById(application.job).select('title company');
    const jobLabel = job ? `"${job.title}" at ${job.company}` : 'your job application';
    const isInterview = application.status === 'Interview';
    const formattedInterviewDate = application.interviewDate
      ? new Date(application.interviewDate).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : null;

    let interviewMessage = `You have been invited to an interview for ${jobLabel}!`;
    if (formattedInterviewDate) {
      interviewMessage = `You have been invited to an interview for ${jobLabel} scheduled for ${formattedInterviewDate}!`;
    }

    await createNotificationSafe({
      recipient: application.applicant,
      type: isInterview ? 'INTERVIEW_INVITATION' : 'APPLICATION_STATUS',
      title: isInterview
        ? 'Interview Invitation'
        : `Application Status Updated: ${application.status}`,
      message: isInterview
        ? interviewMessage
        : `Your application for ${jobLabel} is now "${application.status}".`,
      relatedJob: application.job,
      relatedApplication: application._id,
    });

    res.status(200).json({
      message: 'Application status updated successfully.',
      application: {
        _id: application._id,
        status: application.status,
        interviewDate: application.interviewDate || null,
        updatedAt: application.updatedAt,
      },
    });
  } catch (error) {
    if (
      error.message === 'Invalid application status.' ||
      error.message === 'Invalid interview date.' ||
      error.message.startsWith('Cannot move application back')
    ) {
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