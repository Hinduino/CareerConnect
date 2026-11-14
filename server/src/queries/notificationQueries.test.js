const Notification = require("../models/Notification");
const {
  createNotification,
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require("./notificationQueries");

jest.mock("../models/Notification");

describe("notificationQueries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Notification.findOne.mockResolvedValue(null);
  });

  describe("createNotification", () => {
    it("returns null when required fields are missing", async () => {
      expect(await createNotification({})).toBeNull();
      expect(await createNotification({ recipient: "u1" })).toBeNull();
      expect(await createNotification({ recipient: "u1", title: "Hi" })).toBeNull();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    it("creates a notification with provided and default fields", async () => {
      const mockNotif = { _id: "n1", recipient: "u1", title: "Hi", message: "Msg" };
      Notification.create.mockResolvedValue(mockNotif);

      const res = await createNotification({
        recipient: "u1",
        title: "Hi",
        message: "Msg",
      });
      const dedupeKey = Notification.findOne.mock.calls[0][0].dedupeKey;

      expect(Notification.create).toHaveBeenCalledWith({
        recipient: "u1",
        type: "SYSTEM",
        title: "Hi",
        message: "Msg",
        relatedJob: null,
        relatedApplication: null,
        dedupeKey,
      });
      expect(res).toEqual(mockNotif);
    });

    it("returns an existing notification instead of creating a duplicate", async () => {
      const existing = { _id: "n1", recipient: "u1", title: "Hi", message: "Msg" };
      Notification.findOne.mockResolvedValue(existing);

      const result = await createNotification({
        recipient: "u1",
        title: "Hi",
        message: "Msg",
      });

      expect(result).toBe(existing);
      expect(Notification.findOne).toHaveBeenCalledWith({
        dedupeKey: expect.any(String),
      });
      expect(Notification.create).not.toHaveBeenCalled();
    });

    it("returns the existing notification if a concurrent create wins the unique-key race", async () => {
      const existing = { _id: "n1", recipient: "u1", title: "Hi", message: "Msg" };
      Notification.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);
      Notification.create.mockRejectedValue(Object.assign(new Error("Duplicate key"), { code: 11000 }));

      const result = await createNotification({
        recipient: "u1",
        title: "Hi",
        message: "Msg",
      });

      expect(result).toBe(existing);
      expect(Notification.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe("getNotificationsForUser", () => {
    it("returns sorted notifications and unreadCount", async () => {
      const mockList = [{ _id: "n1", isRead: false }];
      const limitMock = jest.fn().mockResolvedValue(mockList);
      const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
      Notification.find.mockReturnValue({ sort: sortMock });
      Notification.countDocuments.mockResolvedValue(1);

      const result = await getNotificationsForUser("u1");

      expect(Notification.find).toHaveBeenCalledWith({ recipient: "u1" });
      expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
      expect(limitMock).toHaveBeenCalledWith(50);
      expect(Notification.countDocuments).toHaveBeenCalledWith({
        recipient: "u1",
        isRead: false,
      });
      expect(result).toEqual({ notifications: mockList, unreadCount: 1 });
    });
  });

  describe("markNotificationAsRead", () => {
    it("marks a notification as read when found", async () => {
      const updated = { _id: "n1", isRead: true };
      Notification.findOneAndUpdate.mockResolvedValue(updated);

      const res = await markNotificationAsRead("u1", "n1");

      expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "n1", recipient: "u1" },
        { isRead: true },
        { new: true }
      );
      expect(res).toEqual(updated);
    });

    it("throws when notification is not found", async () => {
      Notification.findOneAndUpdate.mockResolvedValue(null);

      await expect(markNotificationAsRead("u1", "missing")).rejects.toThrow(
        "Notification not found."
      );
    });
  });

  describe("markAllNotificationsAsRead", () => {
    it("updates all unread notifications for the user", async () => {
      Notification.updateMany.mockResolvedValue({ modifiedCount: 3 });

      await markAllNotificationsAsRead("u1");

      expect(Notification.updateMany).toHaveBeenCalledWith(
        { recipient: "u1", isRead: false },
        { $set: { isRead: true } }
      );
    });
  });
});