import apiClient from './apiClient';

export const generateRecommendation = (harvestId) => apiClient.post('/recommendations/generate', { harvestId });

export const getLatestRecommendation = (harvestId) => apiClient.get(`/recommendations/${harvestId}/latest`);
