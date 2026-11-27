const mongoose = require('mongoose');
const JobPosting = require('../models/JobPosting');

/**
 * Fetch all postings created by a specific recruiter along with live applicant counts.
 * Extracted from jobRoutes.js to eliminate inline MongoDB aggregation in route handlers
 * and allow isolated unit testing.
 */
async function getRecruiterPostingsWithCounts(recruiterId) {
  return JobPosting.aggregate([
    { $match: { postedBy: mongoose.Types.ObjectId.createFromHexString(recruiterId) } },
    {
      $lookup: {
        from: 'applications',
        localField: '_id',
        foreignField: 'job',
        as: 'applications',
      },
    },
    {
      $addFields: {
        applicantCount: { $size: '$applications' },
      },
    },
    {
      $project: {
        applications: 0,
      },
    },
    { $sort: { createdAt: -1 } },
  ]);
}

/**
 * Fetch a job posting and verify that the requesting recruiter owns it.
 * Consolidates repeated findById + ownership checks across PUT, PATCH /archive, and DELETE.
 */
async function findOwnedJobPosting(jobId, recruiterId, actionLabel = 'modify') {
  const job = await JobPosting.findById(jobId);
  if (!job) {
    const err = new Error('Job not found');
    err.statusCode = 404;
    throw err;
  }

  if (job.postedBy.toString() !== recruiterId) {
    const err = new Error(`You can only ${actionLabel} your own job postings`);
    err.statusCode = 403;
    throw err;
  }

  return job;
}

module.exports = {
  getRecruiterPostingsWithCounts,
  findOwnedJobPosting,
};