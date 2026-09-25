import apiClient from './apiClient';

export const getFarmerProfile = () => apiClient.get('/farmers/profile');

export const updateFarmerProfile = (profile) => apiClient.put('/farmers/profile', profile);
