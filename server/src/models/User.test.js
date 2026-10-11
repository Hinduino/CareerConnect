const User = require("./User");

describe("User profile picture schema", () => {
  it("embeds profile pictures without a separate id and excludes bytes by default", () => {
    const user = new User({
      email: "pictureuser@example.com",
      password: "password123",
      profilePicture: {
        originalName: "avatar.png",
        contentType: "image/png",
        size: 5,
        data: Buffer.from("image"),
      },
    });

    expect(user.profilePicture).toBeDefined();
    expect(user.profilePicture._id).toBeUndefined();
    expect(User.schema.path("profilePicture.data").options.select).toBe(false);
  });

  it("keeps the profile picture absent until upload and requires its metadata and data", async () => {
    const user = new User({ email: "newuser@example.com", password: "password123" });
    expect(user.profilePicture).toBeUndefined();
    await expect(user.validate()).resolves.toBeUndefined();

    user.profilePicture = {};
    await expect(user.validate()).rejects.toMatchObject({
      errors: {
        "profilePicture.originalName": expect.any(Object),
        "profilePicture.contentType": expect.any(Object),
        "profilePicture.size": expect.any(Object),
        "profilePicture.data": expect.any(Object),
      },
    });
  });
});
