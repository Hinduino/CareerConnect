const express = require('express');
const router = express.Router();
const JobPosting = require('../models/JobPosting'); // Uses Nazila's database schema

// GET /api/jobs - Fetch all jobs with search & filtering
router.get('/', async (req, res) => {
    try {
        const { keyword, location, category } = req.query;
        let query = {};

        if (keyword) query.title = { $regex: keyword, $options: 'i' };
        if (location) query.location = { $regex: location, $options: 'i' };
        if (category) query.category = category;

        const jobs = await JobPosting.find(query);
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

module.exports = router;