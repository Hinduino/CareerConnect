const API_BASE = 'http://localhost:3000/api/notifications';

export async function fetchNotifications(token) {
  const response = await fetch(API_BASE, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch notifications');
  }
  return {
    notifications: data.notifications || [],
    unreadCount: data.unreadCount || 0,
  };
}

export async function markNotificationRead(token, notificationId) {
  const response = await fetch(`${API_BASE}/${notificationId}/read`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to mark notification as read');
  }
  return data.notification;
}

export async function markAllNotificationsRead(token) {
  const response = await fetch(`${API_BASE}/read-all`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to mark all notifications as read');
  }
  return data;
}