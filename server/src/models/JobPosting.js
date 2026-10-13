const mongoose = require('mongoose');

const jobPostingSchema = new mongoose.Schema({
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    requirements: { type: String, required: true },
    // The recruiter who owns this posting. Only this user may edit it.
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    // `timestamps: true` below gives us `createdAt` (the original date
    // posted) and `updatedAt` (bumped whenever the recruiter modifies the
    // posting), so the UI can always show an up-to-date "posted"/"updated"
    // date without any extra daily job.
}, { timestamps: true });

module.exports = mongoose.model('JobPosting', jobPostingSchema);