jest.mock("../models/User", () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

const User = require("../models/User");
const {
  deleteProfilePictureByUser,
  findProfilePictureByUser,
  findProfilePictureMetaByUser,
  setProfilePicture,
} = require("./profilePictureQueries");

const userId = "507f1f77bcf86cd799439011";
const picture = {
  originalName: "avatar.png",
  contentType: "image/png",
  size: 4,
  data: Buffer.from("image"),
};

describe("profilePictureQueries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches metadata without selecting image bytes", async () => {
    const select = jest.fn().mockResolvedValue({ profilePicture: picture });
    User.findById.mockReturnValue({ select });

    await expect(findProfilePictureMetaByUser(userId)).resolves.toEqual(picture);
    expect(User.findById).toHaveBeenCalledWith(userId);
    expect(select).toHaveBeenCalledWith(
      "profilePicture.originalName profilePicture.contentType profilePicture.size",
    );
  });

  it("loads image bytes explicitly for the file response", async () => {
    const select = jest.fn().mockResolvedValue({ profilePicture: picture });
    User.findById.mockReturnValue({ select });

    await expect(findProfilePictureByUser(userId)).resolves.toEqual(picture);
    expect(select).toHaveBeenCalledWith(
      "profilePicture.originalName profilePicture.contentType +profilePicture.data",
    );
  });

  it("returns null if a metadata or file lookup has no user picture", async () => {
    const select = jest.fn().mockResolvedValue({ profilePicture: undefined });
    User.findById.mockReturnValue({ select });
    await expect(findProfilePictureMetaByUser(userId)).resolves.toBeNull();

    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    await expect(findProfilePictureByUser(userId)).resolves.toBeNull();
  });

  it("sets picture fields on the user and returns the selected metadata", async () => {
    const select = jest.fn().mockResolvedValue({ profilePicture: picture });
    User.findByIdAndUpdate.mockReturnValue({ select });

    await expect(setProfilePicture(userId, picture)).resolves.toEqual(picture);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      { $set: { profilePicture: picture } },
      { new: true, runValidators: true },
    );
    expect(select).toHaveBeenCalledWith(
      "profilePicture.originalName profilePicture.contentType profilePicture.size",
    );
  });

  it("returns null if setting a picture targets a missing user", async () => {
    User.findByIdAndUpdate.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await expect(setProfilePicture(userId, picture)).resolves.toBeNull();
  });

  it("unsets an existing picture and reports whether one was found", async () => {
    User.findOneAndUpdate.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: userId }),
    });

    await expect(deleteProfilePictureByUser(userId)).resolves.toBe(true);
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: userId, "profilePicture.data": { $exists: true } },
      { $unset: { profilePicture: 1 } },
    );

    User.findOneAndUpdate.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    await expect(deleteProfilePictureByUser(userId)).resolves.toBe(false);
  });
});
