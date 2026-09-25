import apiClient from './apiClient';

export const submitSensorReading = (reading) => apiClient.post('/sensors/readings', reading);

export const getLatestSensorReading = (harvestId) => apiClient.get(`/sensors/readings/${harvestId}`);
