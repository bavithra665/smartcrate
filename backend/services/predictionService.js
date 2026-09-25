const axios = require('axios');
const Prediction = require('../models/Prediction');
const notificationService = require('./notificationService');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || process.env.ML_API_URL || 'http://localhost:8000';
const ML_SERVICE_TIMEOUT_MS = Number(process.env.ML_SERVICE_TIMEOUT_MS || 10000);
const SPOILAGE_RISKS = ['Low', 'Medium', 'High'];

class InvalidHarvestTimestampError extends Error {}
class MlValidationError extends Error {}

const getHarvestDatePart = (harvestDate) => {
  if (harvestDate instanceof Date && !Number.isNaN(harvestDate.getTime())) return harvestDate.toISOString().slice(0, 10);
  if (typeof harvestDate === 'string') {
    const match = harvestDate.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  throw new InvalidHarvestTimestampError('Harvest date must be a valid ISO date');
};

const calculateHoursSinceHarvest = (harvest, observationTimestamp = new Date()) => {
  const datePart = getHarvestDatePart(harvest.harvestDate);
  const timePart = harvest.harvestTime || '00:00';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timePart)) throw new InvalidHarvestTimestampError('Harvest time must use HH:mm format');
  const harvestTimestamp = new Date(`${datePart}T${timePart}:00.000Z`);
  const observation = new Date(observationTimestamp);
  if (Number.isNaN(harvestTimestamp.getTime()) || Number.isNaN(observation.getTime())) throw new InvalidHarvestTimestampError('Harvest and observation timestamps must be valid');
  const elapsedHours = (observation.getTime() - harvestTimestamp.getTime()) / (1000 * 60 * 60);
  if (elapsedHours < 0) throw new InvalidHarvestTimestampError('Harvest timestamp cannot be in the future');
  return elapsedHours;
};

const buildMlPayload = (harvest, sensorReading, observationTimestamp) => ({
  crop: harvest.crop,
  maturity_stage: harvest.maturityStage,
  hours_since_harvest: calculateHoursSinceHarvest(harvest, observationTimestamp || sensorReading.timestamp || new Date()),
  temperature_c: sensorReading.temperature,
  humidity_percent: sensorReading.humidity,
  ethylene_ppm: sensorReading.ethylene,
  voc_index: sensorReading.voc,
  co2_ppm: sensorReading.co2,
});

const validateMlResponse = (data) => {
  if (!data || !SPOILAGE_RISKS.includes(data.spoilage_risk)) throw new Error('ML service returned an invalid spoilage_risk');
  if (!data.model_version || !data.model_source || !data.prediction_timestamp) throw new Error('ML service returned incomplete model metadata');
  const predictionTimestamp = new Date(data.prediction_timestamp);
  if (Number.isNaN(predictionTimestamp.getTime())) throw new Error('ML service returned an invalid prediction_timestamp');
  let probabilities = null;
  if (data.probabilities !== undefined && data.probabilities !== null) {
    if (typeof data.probabilities !== 'object') throw new Error('ML probabilities must be an object');
    probabilities = {};
    for (const risk of SPOILAGE_RISKS) {
      const value = data.probabilities[risk];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new Error(`ML probability for ${risk} is invalid`);
      probabilities[risk] = value;
    }
  }
  return { ...data, predictionTimestamp, probabilities };
};

const isClientValidationError = (error) => error.response && error.response.status >= 400 && error.response.status < 500;

/**
 * Sends harvest + sensor data to the ML FastAPI service.
 * Stores the result in MongoDB.
 * Falls back to rule-based logic if ML service is unavailable.
 */
const runPrediction = async (harvest, sensorReading, options = {}) => {
  const observationTimestamp = options.observationTimestamp || sensorReading.timestamp || new Date();
  const features = buildMlPayload(harvest, sensorReading, observationTimestamp);
  let predictionData;
  let source = 'ml_model';
  let modelVersion;
  let spoilageRiskConfidence = null;
  let shelfLifeResult = null;

  try {
    const response = await axios.post(`${ML_SERVICE_URL}/predict/spoilage-risk`, features, { timeout: ML_SERVICE_TIMEOUT_MS });
    predictionData = validateMlResponse(response.data);
    modelVersion = predictionData.model_version;
    if (predictionData.probabilities) spoilageRiskConfidence = predictionData.probabilities[predictionData.spoilage_risk];
  } catch (error) {
    if (error instanceof InvalidHarvestTimestampError || isClientValidationError(error)) {
      throw error instanceof InvalidHarvestTimestampError ? error : new MlValidationError(`ML service rejected prediction input: ${error.response.status}`);
    }
    console.warn('[PredictionService] ML service unavailable; using rule-based fallback:', error.message);
    source = 'rule_based';
    shelfLifeResult = ruleBasedShelfLife(features);
    predictionData = ruleBasedSpoilageRisk(features);
    modelVersion = 'rule_based_v1';
  }

  const prediction = await Prediction.create({
    harvestId: harvest._id,
    farmerId: harvest.farmerId,
    sensorReadingId: sensorReading._id,
    ...(shelfLifeResult && { remainingShelfLife: shelfLifeResult.remaining_shelf_life, shelfLifeUnit: 'days', shelfLifeConfidence: shelfLifeResult.confidence || null }),
    spoilageRisk: predictionData.spoilage_risk || predictionData.risk,
    spoilageRiskConfidence: spoilageRiskConfidence || predictionData.confidence || null,
    featuresUsed: features,
    modelVersion,
    ...(predictionData.predictionTimestamp && { predictedAt: predictionData.predictionTimestamp }),
    source,
  });

  // Trigger notifications based on prediction
  await notificationService.createPredictionNotifications(harvest, prediction);

  return prediction;
};

// ─── Rule-based fallback (used only when ML service is down) ─────────────────
// This is NOT the production prediction. Replace with ML model.
const ruleBasedShelfLife = (f) => {
  const base = { Tomato: 5, Onion: 20, Banana: 7, Potato: 25, Carrot: 14 };
  let days = base[f.crop] || 7;
  const maturityMap = { 'Immature': 1.3, 'Mature': 1.0, 'Semi-Ripe': 0.85, 'Fully Ripe': 0.6, 'Over-Ripe': 0.3 };
  days *= (maturityMap[f.maturity_stage] || 1.0);
  if (f.temperature_c > 35) days *= 0.6;
  else if (f.temperature_c > 30) days *= 0.75;
  else if (f.temperature_c > 25) days *= 0.9;
  if (f.humidity_percent > 80) days *= 0.8;
  else if (f.humidity_percent > 70) days *= 0.9;
  if (f.ethylene_ppm > 3) days *= 0.75;
  else if (f.ethylene_ppm > 2) days *= 0.85;
  const storageMap = { 'Open Shed': 0.8, 'Cool Storage': 1.1, 'Cold Room': 1.3, 'Refrigerated': 1.5 };
  days *= (storageMap[f.storage_condition] || 1.0);
  return { remaining_shelf_life: Math.max(1, Math.round(days)), confidence: null };
};

const ruleBasedSpoilageRisk = (f) => {
  const sl = ruleBasedShelfLife(f).remaining_shelf_life;
  const risk = sl <= 2 ? 'High' : sl <= 4 ? 'Medium' : 'Low';
  return { risk, confidence: null };
};

module.exports = { runPrediction, buildMlPayload, calculateHoursSinceHarvest, InvalidHarvestTimestampError, MlValidationError };
