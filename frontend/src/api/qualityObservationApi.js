import apiClient from './apiClient';

export const getQualityObservations = (harvestId) => apiClient.get(`/harvests/${harvestId}/quality-observations`);

export const submitQualityObservation = (harvestId, payload) => apiClient.post(`/harvests/${harvestId}/quality-observations`, payload);
