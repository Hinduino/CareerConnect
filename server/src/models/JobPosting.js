const mongoose = require('mongoose');

const jobPostingSchema = new mongoose.Schema({
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    requirements: { type: String, required: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived: {type: Boolean, default: false},
}, { timestamps: true });

jobPostingSchema.index({ postedBy: 1, isArchived: 1 });
jobPostingSchema.index({ isArchived: 1, createdAt: -1 });

module.exports = mongoose.model('JobPosting', jobPostingSchema);
