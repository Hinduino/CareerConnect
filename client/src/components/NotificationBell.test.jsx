const { fireEvent, render, screen, waitFor } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/notificationApi', () => ({
  fetchNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));

const NotificationBell = require('./NotificationBell').default;
const { useAuth } = require('../context/AuthContext');
const { fetchNotifications, markNotificationRead } = require('../api/notificationApi');

describe('NotificationBell navigation', () => {
  const notification = {
    _id: 'notification-1',
    title: 'Application status updated',
    message: 'Your application has moved to interview.',
    isRead: false,
    relatedJob: 'job-1',
    relatedApplication: 'application-1',
    createdAt: '2026-11-13T12:00:00.000Z',
  };
  const notificationsData = { notifications: [notification], unreadCount: 1 };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'test-token', isAuthenticated: true });
    fetchNotifications.mockResolvedValue(notificationsData);
    markNotificationRead.mockResolvedValue({ ...notification, isRead: true });
  });

  it('marks a notification as read and opens its corresponding application', async () => {
    const onOpenNotification = jest.fn();
    render(<NotificationBell onOpenNotification={onOpenNotification} />);

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    const openNotification = await screen.findByRole('button', {
      name: 'Open notification: Application status updated',
    });
    fireEvent.click(openNotification);

    await waitFor(() => {
      expect(markNotificationRead).toHaveBeenCalledWith('test-token', 'notification-1');
      expect(onOpenNotification).toHaveBeenCalledWith(notification);
    });
  });
});
