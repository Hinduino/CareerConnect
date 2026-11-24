const mongoose = require('mongoose');

// REFACTORED (SCRUM-383): Added trim: true on string fields for schema-level sanitization
// and guarded model export to prevent OverwriteModelError during unit/integration test runs.
const jobPostingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  requirements: { type: String, required: true, trim: true },
  dueDate: { type: Date, default: null },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isArchived: { type: Boolean, default: false },
}, { timestamps: true });

jobPostingSchema.index({ postedBy: 1, isArchived: 1 });
jobPostingSchema.index({ isArchived: 1, createdAt: -1 });

module.exports = mongoose.models.JobPosting || mongoose.model('JobPosting', jobPostingSchema);