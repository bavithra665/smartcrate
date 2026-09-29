import React from 'react';
import { FaInfoCircle, FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';

const icons = {
  info: <FaInfoCircle />,
  success: <FaCheckCircle />,
  warning: <FaExclamationTriangle />,
  danger: <FaTimesCircle />,
};

const colors = {
  info: { bg: '#ebf8ff', border: '#bee3f8', icon: '#2b6cb0' },
  success: { bg: '#f0fff4', border: '#c6f6d5', icon: '#276749' },
  warning: { bg: '#fffaf0', border: '#fbd38d', icon: '#c05621' },
  danger: { bg: '#fff5f5', border: '#fed7d7', icon: '#c53030' },
};

export default function NotificationCard({ notification, onMarkRead }) {
  const c = colors[notification.type] || colors.info;
  return (
    <div style={{
      background: notification.read ? 'var(--white)' : c.bg,
      border: `1px solid ${notification.read ? 'var(--border)' : c.border}`,
      borderRadius: 'var(--radius-sm)',
      padding: '14px 16px',
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start',
      opacity: notification.read ? 0.75 : 1,
    }}>
      <div style={{ color: c.icon, fontSize: '1.2rem', marginTop: 2, flexShrink: 0 }}>
        {icons[notification.type]}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-dark)', marginBottom: 3 }}>
          {notification.title}
          {!notification.read && (
            <span style={{
              display: 'inline-block', width: 8, height: 8,
              background: c.icon, borderRadius: '50%', marginLeft: 8, verticalAlign: 'middle'
            }} />
          )}
        </div>
        <div style={{ fontSize: '0.88rem', color: 'var(--text-medium)', marginBottom: 6 }}>
          {notification.message}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
            {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Time unavailable'}
          </span>
          {!notification.read && onMarkRead && (
            <button
              className="btn btn-outline btn-sm"
              style={{ padding: '2px 10px', fontSize: '0.75rem' }}
              onClick={() => onMarkRead(notification._id || notification.id)}
            >
              Mark as Read
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
