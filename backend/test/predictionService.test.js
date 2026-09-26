process.env.NODE_ENV = 'test';
process.env.ML_SERVICE_URL = 'http://ml.test';
process.env.ML_SERVICE_TIMEOUT_MS = '4321';

jest.mock('axios', () => ({
  post: jest.fn(),
}));
jest.mock('../models/Prediction', () => ({
  create: jest.fn(),
}));
jest.mock('../services/notificationService', () => ({
  createPredictionNotifications: jest.fn().mockResolvedValue(null),
}));

const axios = require('axios');
const Prediction = require('../models/Prediction');
const predictionService = require('../services/predictionService');

const harvest = {
  _id: 'harvest-1',
  farmerId: 'farmer-1',
  crop: 'Tomato',
  maturityStage: 'Fully Ripe',
  harvestDate: '2026-09-25',
  harvestTime: '06:30',
};
const sensorReading = {
  _id: 'reading-1',
  timestamp: new Date('2026-09-26T06:30:00.000Z'),
  temperature: 25.5,
  humidity: 60,
  ethylene: 1.2,
  voc: 0.8,
  co2: 420,
  hours_since_harvest: 999,
};
const mlResponse = {
  spoilage_risk: 'Medium',
  probabilities: { Low: 0.2, Medium: 0.7, High: 0.1 },
  model_version: 'spoilage_risk_baseline',
  model_source: 'exploratory_baseline',
  prediction_timestamp: '2026-09-26T06:30:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  Prediction.create.mockImplementation(async (value) => value);
});

test('sends the exact ML feature contract and stores the ML result', async () => {
  axios.post.mockResolvedValue({ data: mlResponse });

  const result = await predictionService.runPrediction(harvest, sensorReading);

  expect(axios.post).toHaveBeenCalledWith(
    'http://ml.test/predict/spoilage-risk',
    {
      crop: 'Tomato',
      maturity_stage: 'Fully Ripe',
      hours_since_harvest: 24,
      temperature_c: 25.5,
      humidity_percent: 60,
      ethylene_ppm: 1.2,
      voc_index: 0.8,
      co2_ppm: 420,
    },
    { timeout: 4321 }
  );
  expect(Prediction.create).toHaveBeenCalledWith(expect.objectContaining({
    harvestId: 'harvest-1',
    farmerId: 'farmer-1',
    sensorReadingId: 'reading-1',
    spoilageRisk: 'Medium',
    spoilageRiskConfidence: 0.7,
    modelVersion: 'spoilage_risk_baseline',
    source: 'ml_model',
  }));
  expect(Prediction.create.mock.calls[0][0]).not.toHaveProperty('remainingShelfLife');
  expect(result.source).toBe('ml_model');
});

test('derives elapsed hours from UTC harvest date/time and ignores client elapsed time', () => {
  expect(predictionService.buildMlPayload(harvest, sensorReading)).toEqual(expect.objectContaining({
    hours_since_harvest: 24,
  }));
  expect(predictionService.buildMlPayload(harvest, sensorReading)).not.toHaveProperty('hours_since_harvest', 999);
});

test('uses the existing rule-based spoilage fallback without fabricating shelf life', async () => {
  axios.post.mockRejectedValue(new Error('connect ETIMEDOUT'));

  const result = await predictionService.runPrediction(harvest, sensorReading);

  expect(result.source).toBe('rule_based');
  expect(Prediction.create).toHaveBeenCalledWith(expect.objectContaining({
    source: 'rule_based',
    modelVersion: 'rule_based_v1',
  }));
  expect(Prediction.create.mock.calls[0][0]).not.toHaveProperty('remainingShelfLife');
});

test('keeps spoilage prediction when FastAPI reports shelf-life model not ready', async () => {
  axios.post
    .mockResolvedValueOnce({ data: mlResponse })
    .mockRejectedValueOnce({ response: { status: 503 } });

  const result = await predictionService.runPrediction(harvest, sensorReading);

  expect(axios.post).toHaveBeenNthCalledWith(
    2,
    'http://ml.test/predict/shelf-life',
    {
      crop: 'Tomato',
      maturity_stage: 'Fully Ripe',
      hours_since_harvest: 24,
      temperature: 25.5,
      humidity: 60,
      ethylene: 1.2,
      voc_index: 0.8,
      co2: 420,
    },
    { timeout: 4321 }
  );
  expect(result.spoilageRisk).toBe('Medium');
  expect(Prediction.create.mock.calls[0][0]).not.toHaveProperty('remainingShelfLife');
  expect(Prediction.create.mock.calls[0][0]).toEqual(expect.objectContaining({ modelVersion: 'spoilage_risk_baseline' }));
});

test('stores shelf life only with validated model provenance', async () => {
  axios.post
    .mockResolvedValueOnce({ data: mlResponse })
    .mockResolvedValueOnce({
      data: {
        remaining_shelf_life_days: 3.5,
        model_version: 'shelf_life_regression_v1',
        model_source: 'longitudinal_regression',
        prediction_timestamp: '2026-09-26T06:30:00.000Z',
      },
    });

  await predictionService.runPrediction(harvest, sensorReading);

  expect(Prediction.create).toHaveBeenCalledWith(expect.objectContaining({
    remainingShelfLife: 3.5,
    shelfLifeModelVersion: 'shelf_life_regression_v1',
    shelfLifeModelSource: 'longitudinal_regression',
    shelfLifePredictedAt: new Date('2026-09-26T06:30:00.000Z'),
    modelVersion: 'spoilage_risk_baseline',
  }));
});

test('does not convert an ML validation response into a fallback prediction', async () => {
  axios.post.mockRejectedValue({ response: { status: 422 } });

  await expect(predictionService.runPrediction(harvest, sensorReading))
    .rejects.toThrow('ML service rejected prediction input: 422');
  expect(Prediction.create).not.toHaveBeenCalled();
});

test('rejects invalid or future harvest timestamps without calling ML', async () => {
  const futureHarvest = { ...harvest, harvestDate: '2026-09-27' };

  await expect(predictionService.runPrediction(futureHarvest, sensorReading))
    .rejects.toThrow('Harvest timestamp cannot be in the future');
  expect(axios.post).not.toHaveBeenCalled();
});
