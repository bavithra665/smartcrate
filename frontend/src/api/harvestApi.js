import apiClient from './apiClient';

export const getHarvests = (status) => apiClient.get('/harvests', {
  params: status ? { status } : undefined,
});

export const getHarvest = (id) => apiClient.get(`/harvests/${id}`);

export const createHarvest = (harvest) => apiClient.post('/harvests', harvest);

export const updateHarvest = (id, harvest) => apiClient.put(`/harvests/${id}`, harvest);

export const deleteHarvest = (id) => apiClient.delete(`/harvests/${id}`);

export const toHarvestPayload = (form) => ({
  crop: form.cropType,
  variety: form.variety || undefined,
  quantity: Number(form.quantity),
  unit: 'kg',
  harvestDate: form.harvestDate,
  harvestTime: form.harvestTime || undefined,
  maturityStage: form.maturityStage || undefined,
  storageCondition: form.storageCondition || undefined,
});

export const normalizeHarvest = (harvest) => ({
  ...harvest,
  id: harvest._id || harvest.id,
  harvestDate: typeof harvest.harvestDate === 'string'
    ? harvest.harvestDate.split('T')[0]
    : harvest.harvestDate,
});
