const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const JobPosting = require('../models/JobPosting');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const {
  toggleFavoriteJob,
  getFavoriteJobIds,
  getFavoriteJobs,
} = require('../queries/favoriteQueries');
const {
  getRecruiterPostingsWithCounts,
  findOwnedJobPosting,
} = require('../queries/jobQueries');
const { sendDeadlineRemindersForJob } = require('../services/applicationReminderService');

const REQUIRED_FIELDS = ['title', 'company', 'location', 'category', 'description', 'requirements'];

function validateJobFields(body) {
  for (const field of REQUIRED_FIELDS) {
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      return `${field} is required`;
    }
  }
  return null;
}

function validateDueDate(dueDate) {
  if (dueDate === undefined || dueDate === null || dueDate === '') {
    return null;
  }

  return Number.isNaN(new Date(dueDate).getTime())
    ? 'dueDate must be a valid date'
    : null;
}

function parseAndValidateJobPayload(body) {
  const validationError = validateJobFields(body);
  if (validationError) {
    return { error: validationError };
  }

  const dueDateError = validateDueDate(body.dueDate);
  if (dueDateError) {
    return { error: dueDateError };
  }

  return {
    data: {
      title: body.title.trim(),
      company: body.company.trim(),
      location: body.location.trim(),
      category: body.category.trim(),
      description: body.description.trim(),
      requirements: body.requirements.trim(),
    },
  };
}

function validateJobId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid job ID' });
  }
  next();
}

// =========================================================================
// JOB SEEKER FAVORITES / SAVED JOBS ROUTES (SCRUM-281)
// =========================================================================

router.get('/favorites', requireAuth, requireRole('job_seeker'), async (req, res) => {
  try {
    const favoriteJobs = await getFavoriteJobs(req.user.id);
    res.status(200).json(favoriteJobs);
  } catch (error) {
    console.error('Error fetching favorite jobs:', error);
    res.status(500).json({ error: 'Server error fetching favorite jobs' });
  }
});

router.get('/favorites/ids', requireAuth, requireRole('job_seeker'), async (req, res) => {
  try {
    const favoriteIds = await getFavoriteJobIds(req.user.id);
    res.status(200).json({ favoriteIds });
  } catch (error) {
    console.error('Error fetching favorite job IDs:', error);
    res.status(500).json({ error: 'Server error fetching favorite job IDs' });
  }
});

router.post('/:id/favorite', requireAuth, requireRole('job_seeker'), validateJobId, async (req, res) => {
  try {
    const result = await toggleFavoriteJob(req.user.id, req.params.id);
    res.status(200).json({
      message: result.favorited ? 'Job added to favorites' : 'Job removed from favorites',
      favorited: result.favorited,
      savedJobIds: result.savedJobIds,
    });
  } catch (error) {
    if (error.message === 'Job not found.' || error.message === 'User not found.') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error toggling favorite job:', error);
    res.status(500).json({ error: 'Server error toggling favorite job' });
  }
});

// =========================================================================
// RECRUITER POSTING MANAGEMENT ROUTES (SCRUM-340 / SCRUM-383)
// =========================================================================

router.get(['/mine', '/recruiter/my-postings'], requireAuth, requireRole('recruiter'), async (req, res) => {
  try {
    const jobsWithCounts = await getRecruiterPostingsWithCounts(req.user.id);
    res.status(200).json(jobsWithCounts);
  } catch (error) {
    console.error('Error fetching recruiter job postings:', error);
    res.status(500).json({ error: 'Server error fetching your job postings' });
  }
});

router.patch('/:id/archive', requireAuth, requireRole('recruiter'), validateJobId, async (req, res) => {
  try {
    const job = await findOwnedJobPosting(req.params.id, req.user.id, 'archive');

    job.isArchived = !job.isArchived;
    await job.save();

    res.status(200).json({
      message: `Job posting ${job.isArchived ? 'archived' : 'unarchived'} successfully`,
      job,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error toggling archive status:', error);
    res.status(500).json({ error: 'Server error toggling archive status' });
  }
});

// =========================================================================
// GENERAL JOB LISTING & SEARCH ROUTES (APPLICANT & PUBLIC)
// =========================================================================

router.get('/', async (req, res) => {
  try {
    const { keyword, location, category } = req.query;
    const query = { isArchived: { $ne: true } };

    if (keyword) query.title = { $regex: keyword, $options: 'i' };
    if (location) query.location = { $regex: location, $options: 'i' };
    if (category) query.category = category;

    const jobs = await JobPosting.find(query).sort({ createdAt: -1 });
    res.status(200).json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching jobs' });
  }
});

router.get('/:id', validateJobId, async (req, res) => {
  try {
    const job = await JobPosting.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.status(200).json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching job details' });
  }
});

router.post('/', requireAuth, requireRole('recruiter'), async (req, res) => {
  try {
    const { error, data } = parseAndValidateJobPayload(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    const job = await JobPosting.create({
      ...data,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      postedBy: req.user.id,
      isArchived: false,
    });

    if (job.dueDate) {
      await sendDeadlineRemindersForJob(job);
    }

    res.status(201).json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error creating job posting' });
  }
});

router.put('/:id', requireAuth, requireRole('recruiter'), validateJobId, async (req, res) => {
  try {
    const job = await findOwnedJobPosting(req.params.id, req.user.id, 'modify');

    const { error, data } = parseAndValidateJobPayload(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    Object.assign(job, data);
    if (Object.prototype.hasOwnProperty.call(req.body, 'dueDate')) {
      job.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    }
    await job.save();

    if (job.dueDate && !job.isArchived) {
      await sendDeadlineRemindersForJob(job);
    }

    res.status(200).json(job);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Server error updating job posting' });
  }
});

router.delete('/:id', requireAuth, requireRole('recruiter'), validateJobId, async (req, res) => {
  try {
    const job = await findOwnedJobPosting(req.params.id, req.user.id, 'delete');
    await job.deleteOne();
    res.status(200).json({ message: 'Job posting deleted successfully' });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Server error deleting job posting' });
  }
});

module.exports = router;