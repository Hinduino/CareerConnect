const mongoose = require('mongoose');

const jobPostingSchema = new mongoose.Schema({
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    requirements: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('JobPosting', jobPostingSchema);