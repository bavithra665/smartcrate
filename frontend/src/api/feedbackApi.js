import apiClient from './apiClient';

export const getFeedback = () => apiClient.get('/feedback');

export const submitFeedback = (payload) => apiClient.post('/feedback', payload);