import React, { useEffect, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import NotificationCard from '../components/NotificationCard';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notificationApi';
import { FaBell, FaCheckDouble } from 'react-icons/fa';

export default function Notifications({ farmer, onLogout }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    getNotifications()
      .then((response) => { if (mounted) setNotifications(response.data || []); })
      .catch((apiError) => { if (mounted) setError(apiError.response?.data?.message || 'Unable to load notifications.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const markRead = async (id) => {
    try {
      const response = await markNotificationRead(id);
      setNotifications((previous) => previous.map((item) => (item._id || item.id) === id ? response.data : item));
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Unable to update notification.');
    }
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((previous) => previous.map((item) => ({ ...item, read: true })));
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Unable to update notifications.');
    }
  };

  const unread = notifications.filter(n => !n.read).length;

  return (
    <DashboardLayout farmer={farmer} pageTitle="Notifications" onLogout={onLogout}>
      <div className="page-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Notifications</h1>
            <p className="page-subtitle">
              {unread > 0 ? `You have ${unread} unread notification${unread > 1 ? 's' : ''}.` : 'All notifications are read.'}
            </p>
          </div>
          {unread > 0 && (
            <button className="btn btn-outline btn-sm" onClick={markAllRead}>
              <FaCheckDouble /> Mark All as Read
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading ? <div className="empty-state">Loading notifications...</div> : notifications.length === 0 ? (
          <div className="empty-state">
            <FaBell />
            <p>No notifications yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notifications.map(n => (
              <NotificationCard key={n.id} notification={n} onMarkRead={markRead} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
