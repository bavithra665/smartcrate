import apiClient from './apiClient';

export const getAdminStats = () => apiClient.get('/admin/stats');

export const getPredictionEvaluation = () => apiClient.get('/admin/prediction-evaluation');

export const getMlDataReadiness = () => apiClient.get('/admin/ml-data-readiness');