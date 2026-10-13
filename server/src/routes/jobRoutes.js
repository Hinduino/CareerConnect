const express = require('express');
const router = express.Router();
const JobPosting = require('../models/JobPosting'); // Uses Nazila's database schema
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

// GET /api/jobs/mine - Fetch the postings created by the logged-in recruiter.
// Declared before the /:id route so "mine" is never mistaken for an id.
router.get('/mine', requireAuth, requireRole('recruiter'), async (req, res) => {
    try {
        const jobs = await JobPosting.find({ postedBy: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(jobs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error fetching your job postings' });
    }
});

// GET /api/jobs - Fetch all jobs with search & filtering
router.get('/', async (req, res) => {
    try {
        const { keyword, location, category } = req.query;
        const query = {};

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
router.get('/:id', async (req, res) => {
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
            postedBy: req.user.id
        });

        res.status(201).json(job);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error creating job posting' });
    }
});

// PUT /api/jobs/:id - Recruiters modify a posting they own
router.put('/:id', requireAuth, requireRole('recruiter'), async (req, res) => {
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
        // `updatedAt` is bumped automatically by the timestamps option on save.
        await job.save();

        res.status(200).json(job);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error updating job posting' });
    }
});

module.exports = router;