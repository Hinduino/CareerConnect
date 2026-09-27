const User = require("../models/User");

async function createUser({ email, password, name, role }) {
  return await User.create({ email, password, name, role });
}

async function findUserByEmail(email) {
  return await User.findOne({ email });
}

async function findUserById(id) {
  return await User.findById(id);
}

async function updateUser(id, updates) {
  return await User.findByIdAndUpdate(id, updates, { new: true });
}

async function deleteUser(id) {
  return await User.findByIdAndDelete(id);
}

module.exports = { createUser, findUserByEmail, findUserById, updateUser, deleteUser };