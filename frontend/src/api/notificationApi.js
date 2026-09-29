import apiClient from './apiClient';

export const getNotifications = () => apiClient.get('/notifications');

export const markNotificationRead = (id) => apiClient.put(`/notifications/${id}/read`);

export const markAllNotificationsRead = () => apiClient.put('/notifications/read-all');