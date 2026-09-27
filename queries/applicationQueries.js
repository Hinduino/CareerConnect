const Application = require("../models/Application");

async function createApplication(data) {
  return await Application.create(data);
}

async function getApplicationsByUser(userId) {
  return await Application.find({ applicant: userId });
}

async function updateApplicationStatus(id, status) {
  return await Application.findByIdAndUpdate(id, { status }, { new: true });
}

module.exports = { createApplication, getApplicationsByUser, updateApplicationStatus };