const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const JobPosting = require('../models/JobPosting');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const REQUIRED_FIELDS = ['title', 'company', 'location', 'category', 'description', 'requirements'];

function validateJobFields(body) {
    for (const field of REQUIRED_FIELDS) {
        if (typeof body[field] !== 'string' || !body[field].trim()) {
            return `${field} is required`;
        }
    }
    return null;
}

function validateJobId(req, res, next) {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'Invalid job ID' });
    }
    next();
}

// =========================================================================
// RECRUITER POSTING MANAGEMENT ROUTES (SCRUM-310)
// =========================================================================

router.get(['/mine', '/recruiter/my-postings'], requireAuth, requireRole('recruiter'), async (req, res) => {    
  try {
    const jobsWithCounts = await JobPosting.aggregate([
      { $match: { postedBy: mongoose.Types.ObjectId.createFromHexString(req.user.id) } },
      {
        $lookup: {
          from: 'applications',
          localField: '_id',
          foreignField: 'job',
          as: 'applications'
        }
      },
      {
        $addFields: {
          applicantCount: { $size: '$applications' }
        }
      },
      {
        $project: {
          applications: 0
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.status(200).json(jobsWithCounts);
  } catch (error) {
    console.error('Error fetching recruiter job postings:', error);
    res.status(500).json({ error: 'Server error fetching your job postings' });
  }
});

// PATCH /api/jobs/:id/archive - Toggle archive status for a recruiter's job posting
router.patch('/:id/archive', requireAuth, requireRole('recruiter'), validateJobId, async (req, res) => {
  try {
    const job = await JobPosting.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You can only archive your own job postings' });
    }

    job.isArchived = !job.isArchived;
    await job.save();

    res.status(200).json({
      message: `Job posting ${job.isArchived ? 'archived' : 'unarchived'} successfully`,
      job,
    });
  } catch (error) {
    console.error('Error toggling archive status:', error);
    res.status(500).json({ error: 'Server error toggling archive status' });
  }
});

// =========================================================================
// GENERAL JOB LISTING & SEARCH ROUTES (APPLICANT & PUBLIC)
// =========================================================================

// GET /api/jobs - Fetch all non-archived jobs with search & filtering
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

// GET /api/jobs/:id - Fetch detailed view of a single job
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

// POST /api/jobs - Recruiters create a new job posting, tied to their account
router.post('/', requireAuth, requireRole('recruiter'), async (req, res) => {
    try {
        const validationError = validateJobFields(req.body);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const { title, company, location, category, description, requirements } = req.body;
        const job = await JobPosting.create({
            title: title.trim(),
            company: company.trim(),
            location: location.trim(),
            category: category.trim(),
            description: description.trim(),
            requirements: requirements.trim(),
            postedBy: req.user.id,
            isArchived: false,
        });

        res.status(201).json(job);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error creating job posting' });
    }
});

// PUT /api/jobs/:id - Recruiters modify a posting they own
router.put('/:id', requireAuth, requireRole('recruiter'), validateJobId, async (req, res) => {
    try {
        const job = await JobPosting.findById(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        if (job.postedBy.toString() !== req.user.id) {
            return res.status(403).json({ error: 'You can only modify your own job postings' });
        }

        const validationError = validateJobFields(req.body);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const { title, company, location, category, description, requirements } = req.body;
        job.title = title.trim();
        job.company = company.trim();
        job.location = location.trim();
        job.category = category.trim();
        job.description = description.trim();
        job.requirements = requirements.trim();
        await job.save();

        res.status(200).json(job);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error updating job posting' });
    }
});

// DELETE /api/jobs/:id - Recruiters delete their own job postings
router.delete('/:id', requireAuth, requireRole('recruiter'), validateJobId, async (req, res) => {
    try {
        const job = await JobPosting.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.postedBy.toString() !== req.user.id) {
            return res.status(403).json({
                error: 'You can only delete your own job postings'
            });
        }

        await job.deleteOne();
        res.status(200).json({ message: 'Job posting deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error deleting job posting' });
    }
});

module.exports = router;
