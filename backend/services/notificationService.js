const prisma = require('../config/prisma');

const create = async (farmerId, harvestId, type, title, message) => {
  return prisma.notification.create({ data: { farmerId, harvestId, type, title, message } });
};

/**
 * Called automatically after a new prediction is saved.
 * Creates relevant in-app notifications.
 */
const createPredictionNotifications = async (harvest, prediction) => {
  const { farmerId, id: harvestId, crop } = harvest;
  const { spoilageRisk, remainingShelfLife } = prediction;

  if (spoilageRisk === 'High') {
    await create(farmerId, harvestId, 'danger',
      'High Spoilage Risk Detected',
      `Your ${crop} batch has a HIGH spoilage risk. Remaining shelf life: ${remainingShelfLife} day(s). Sell immediately.`
    );
  } else if (spoilageRisk === 'Medium' && remainingShelfLife <= 3) {
    await create(farmerId, harvestId, 'warning',
      'Shelf Life Alert',
      `Your ${crop} batch has approximately ${remainingShelfLife} day(s) of remaining shelf life. Consider selling soon.`
    );
  } else if (spoilageRisk === 'Low') {
    await create(farmerId, harvestId, 'success',
      'Good Storage Conditions',
      `Your ${crop} batch is in good condition with ${remainingShelfLife} day(s) of shelf life remaining.`
    );
  }
};

module.exports = { create, createPredictionNotifications };
