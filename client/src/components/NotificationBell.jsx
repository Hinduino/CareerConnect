import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/notificationApi';

function NotificationBell({ onOpenNotification }) {
  const { token, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      return;
    }

    let cancelled = false;

    const syncNotifications = async () => {
      try {
        const data = await fetchNotifications(token);
        if (!cancelled) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
        }
      } catch (err) {
        console.error('Error loading notifications:', err);
      }
    };

    syncNotifications();
    const intervalId = setInterval(syncNotifications, 30000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isAuthenticated, token]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleDropdown = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && token) {
      setLoading(true);
      try {
        const data = await fetchNotifications(token);
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      } catch (err) {
        console.error('Error loading notifications:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMarkAsRead = async (notification) => {
    if (notification.isRead) return;
    try {
      await markNotificationRead(token, notification._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleNotificationClick = async (notification) => {
    await handleMarkAsRead(notification);
    onOpenNotification?.(notification);
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      await markAllNotificationsRead(token);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={handleToggleDropdown}
        aria-label="Notifications"
        aria-expanded={isOpen}
        style={{
          position: 'relative',
          padding: '6px 12px',
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          backgroundColor: isOpen ? '#f1f5f9' : '#ffffff',
          cursor: 'pointer',
          fontWeight: '600',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>🔔</span>
        {unreadCount > 0 && (
          <span
            style={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              borderRadius: '999px',
              padding: '1px 7px',
              fontSize: '0.75rem',
              fontWeight: '700',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="region"
          aria-label="Notifications panel"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '340px',
            maxHeight: '420px',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.12)',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
            }}
          >
            <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>Notifications</strong>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4f46e5',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {loading && notifications.length === 0 ? (
            <p style={{ padding: '16px', margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
              Loading notifications...
            </p>
          ) : notifications.length === 0 ? (
            <p
              style={{
                padding: '24px 16px',
                margin: 0,
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.875rem',
              }}
            >
              No notifications yet.
            </p>
          ) : (
            <div>
              {notifications.map((notif) => (
                <button
                  type="button"
                  key={notif._id}
                  onClick={() => handleNotificationClick(notif)}
                  aria-label={`Open notification: ${notif.title}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    font: 'inherit',
                    padding: '12px 14px',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: notif.isRead ? '#ffffff' : '#eff6ff',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ fontWeight: '600', fontSize: '0.85rem', color: '#1e293b' }}>
                      {notif.title}
                    </span>
                    {!notif.isRead && (
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#3b82f6',
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                  <p style={{ margin: '0 0 6px 0', fontSize: '0.82rem', color: '#475569' }}>
                    {notif.message}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {new Date(notif.createdAt).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;