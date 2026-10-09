const mongoose = require('mongoose');

const jobPostingSchema = new mongoose.Schema({
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    requirements: { type: String, required: true }
}, { timestamps: true });

// This export turns the schema into a fully functional Mongoose model with .find()
module.exports = mongoose.model('JobPosting', jobPostingSchema);