const { toProfile } = require("./userProfile");

describe("toProfile", () => {
  it("exposes only the client-safe profile fields", () => {
    const user = {
      _id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      role: "job_seeker",
      location: "Montreal",
      bio: "Developer",
      password: "hashed-secret",
      profilePicture: { originalName: "me.png" },
    };

    expect(toProfile(user)).toEqual({
      id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      role: "job_seeker",
      location: "Montreal",
      bio: "Developer",
      hasProfilePicture: true,
    });
  });

  it("reports a missing profile picture", () => {
    expect(toProfile({ _id: "user-2" }).hasProfilePicture).toBe(false);
  });
});
