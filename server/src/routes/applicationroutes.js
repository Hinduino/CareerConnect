const express = require('express');
const router = express.Router();
const { createApplication } = require('../queries/applicationQueries');
// Assuming you have an authentication middleware from Sprint 1
// const requireAuth = require('../middleware/auth'); 

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