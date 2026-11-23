// The profile fields that are safe to send to / accept from the client.
// Password hashes and file bytes must never pass through here.
function toProfile(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    location: user.location,
    bio: user.bio,
    hasProfilePicture: Boolean(user.profilePicture),
  };
}

module.exports = { toProfile };
