import apiClient from './apiClient';

export const getMarkets = () => apiClient.get('/markets');

export const getLatestMarketPrices = (crop) => apiClient.get('/markets/prices/latest', {
  params: crop ? { crop } : undefined,
});

export const compareMarkets = (crop) => apiClient.get('/markets/compare', {
  params: crop ? { crop } : undefined,
});

export const syncMarketPrices = (payload = {}) => apiClient.post('/markets/sync', payload);
