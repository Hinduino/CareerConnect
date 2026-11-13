jest.mock("../middleware/auth", () => (req, res, next) => {
  req.user = { id: req.get("x-test-user-id") };
  return next();
});
jest.mock("../queries/notificationQueries", () => ({
  getNotificationsForUser: jest.fn(),
  markNotificationAsRead: jest.fn(),
  markAllNotificationsAsRead: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const {
  getNotificationsForUser,
  markNotificationAsRead,
} = require("../queries/notificationQueries");
const notificationRoutes = require("./notificationRoutes");

const userAId = "507f1f77bcf86cd799439011";
const userBId = "507f1f77bcf86cd799439022";
const notificationId = "507f1f77bcf86cd799439033";
const app = express();
app.use(express.json());
app.use("/notifications", notificationRoutes);

describe("notification routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns notifications associated with the authenticated user", async () => {
    const userNotification = {
      _id: notificationId,
      recipient: userBId,
      title: "Application update",
      isRead: false,
    };
    getNotificationsForUser.mockResolvedValue({
      notifications: [userNotification],
      unreadCount: 1,
    });

    const response = await request(app)
      .get("/notifications")
      .set("x-test-user-id", userBId);

    expect(response.status).toBe(200);
    expect(getNotificationsForUser).toHaveBeenCalledWith(userBId);
    expect(response.body).toEqual({
      notifications: [expect.objectContaining({ recipient: userBId, isRead: false })],
      unreadCount: 1,
    });
  });

  it("returns unread notifications and marks a selected notification as read", async () => {
    const unreadNotification = {
      _id: notificationId,
      recipient: userBId,
      title: "Application update",
      isRead: false,
    };
    const readNotification = { ...unreadNotification, isRead: true };
    getNotificationsForUser
      .mockResolvedValueOnce({ notifications: [unreadNotification], unreadCount: 1 })
      .mockResolvedValueOnce({ notifications: [readNotification], unreadCount: 0 });
    markNotificationAsRead.mockResolvedValue(readNotification);

    const unreadResponse = await request(app)
      .get("/notifications")
      .set("x-test-user-id", userBId);
    const markReadResponse = await request(app)
      .patch(`/notifications/${notificationId}/read`)
      .set("x-test-user-id", userBId);
    const readResponse = await request(app)
      .get("/notifications")
      .set("x-test-user-id", userBId);

    expect(unreadResponse.body.unreadCount).toBe(1);
    expect(unreadResponse.body.notifications[0].isRead).toBe(false);
    expect(markReadResponse.status).toBe(200);
    expect(markNotificationAsRead).toHaveBeenCalledWith(userBId, notificationId);
    expect(readResponse.body.unreadCount).toBe(0);
    expect(readResponse.body.notifications[0].isRead).toBe(true);
  });

  it("does not allow a user to mark another user's notification as read", async () => {
    const userANotification = {
      _id: notificationId,
      recipient: userAId,
      isRead: false,
    };
    markNotificationAsRead.mockImplementation(async (userId, id) => {
      if (userId !== userANotification.recipient || id !== userANotification._id) {
        throw new Error("Notification not found.");
      }
      return { ...userANotification, isRead: true };
    });

    const response = await request(app)
      .patch(`/notifications/${notificationId}/read`)
      .set("x-test-user-id", userBId);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Notification not found." });
    expect(markNotificationAsRead).toHaveBeenCalledWith(userBId, notificationId);
    expect(response.body.notification).toBeUndefined();
  });
});
