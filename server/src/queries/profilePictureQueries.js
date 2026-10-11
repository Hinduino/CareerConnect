const User = require("../models/User");

// Every function here works on the `profilePicture` field embedded in a
// User document, the same way resumeQueries.js works on `resume`. There is
// no ProfilePicture model and no separate collection.

// Metadata fields only, so the image bytes in profilePicture.data are never
// loaded by accident.
const PICTURE_META =
  "profilePicture.originalName profilePicture.contentType profilePicture.size";

function pictureOf(user) {
  return user && user.profilePicture ? user.profilePicture : null;
}

// Profile picture metadata without the image bytes. Returns null if none.
async function findProfilePictureMetaByUser(userId) {
  const user = await User.findById(userId).select(PICTURE_META);
  return pictureOf(user);
}

// Profile picture including the image bytes (for the file route).
async function findProfilePictureByUser(userId) {
  const user = await User.findById(userId).select(
    "profilePicture.originalName profilePicture.contentType +profilePicture.data"
  );
  return pictureOf(user);
}

// Unlike the resume (which distinguishes "create" from "replace"), a
// profile picture is always just set/overwritten - there's only ever one,
// and there's no reason to reject a re-upload.
async function setProfilePicture(userId, file) {
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        profilePicture: {
          originalName: file.originalName,
          contentType: file.contentType,
          size: file.size,
          data: file.data,
        },
      },
    },
    { new: true, runValidators: true }
  ).select(PICTURE_META);
  return pictureOf(user);
}

// Removes the embedded profile picture field from the user document.
// Returns true if a picture was removed, false if there was none.
async function deleteProfilePictureByUser(userId) {
  const user = await User.findOneAndUpdate(
    { _id: userId, "profilePicture.data": { $exists: true } },
    { $unset: { profilePicture: 1 } }
  ).select("_id");
  return Boolean(user);
}

module.exports = {
  findProfilePictureMetaByUser,
  findProfilePictureByUser,
  setProfilePicture,
  deleteProfilePictureByUser,
};
