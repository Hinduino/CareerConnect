const JobPosting = require("../models/JobPosting");

async function createJobPosting(data) {
  return await JobPosting.create(data);
}

async function getAllJobPostings() {
  return await JobPosting.find();
}

async function getJobPostingById(id) {
  return await JobPosting.findById(id);
}

module.exports = { createJobPosting, getAllJobPostings, getJobPostingById };