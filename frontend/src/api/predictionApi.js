import apiClient from './apiClient';

export const getLatestPrediction = (harvestId) => apiClient.get(`/predictions/${harvestId}/latest`);

export const getPredictionHistory = (harvestId) => apiClient.get(`/predictions/${harvestId}/history`);
