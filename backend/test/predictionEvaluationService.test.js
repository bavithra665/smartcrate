process.env.NODE_ENV = 'test';

jest.mock('../models/Prediction', () => ({ find: jest.fn() }));
jest.mock('../models/FarmerFeedback', () => ({ find: jest.fn() }));
jest.mock('../models/Harvest', () => ({ find: jest.fn() }));
jest.mock('../models/SensorReading', () => ({ find: jest.fn() }));

const Prediction = require('../models/Prediction');
const FarmerFeedback = require('../models/FarmerFeedback');
const Harvest = require('../models/Harvest');
const SensorReading = require('../models/SensorReading');
const {
  calculateBinaryMetrics,
  evaluatePredictions,
} = require('../services/predictionEvaluationService');

const farmerId = 'farmer-1';
const harvestId = 'harvest-1';
const prediction = (overrides = {}) => ({
  _id: 'prediction-1',
  farmerId,
  harvestId,
  sensorReadingId: 'sensor-1',
  spoilageRisk: 'High',
  modelVersion: 'spoilage_risk_baseline',
  source: 'ml_model',
  predictedAt: new Date('2026-09-20T10:00:00Z'),
  featuresUsed: { temperature_c: 30, humidity_percent: 70 },
  ...overrides,
});

const feedback = (overrides = {}) => ({
  _id: 'feedback-1',
  farmerId,
  harvestId,
  predictionId: 'prediction-1',
  actualSpoilageOutcome: 'Full Spoilage',
  observedAt: new Date('2026-09-22T10:00:00Z'),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  Harvest.find.mockResolvedValue([{ _id: harvestId, crop: 'Tomato', quantity: 10 }]);
  SensorReading.find.mockResolvedValue([{ _id: 'sensor-1', timestamp: new Date('2026-09-20T09:00:00Z'), temperature: 30 }]);
});

test('prediction with no feedback is unevaluated', async () => {
  Prediction.find.mockResolvedValue([prediction()]);
  FarmerFeedback.find.mockResolvedValue([]);

  const result = await evaluatePredictions();

  expect(result.evaluatedSamples).toBe(0);
  expect(result.unevaluatedSamples).toBe(1);
  expect(result.records[0].evaluable).toBe(false);
  expect(result.records[0].actualOutcome).toBeNull();
});

test('prediction with valid explicit feedback is evaluable', async () => {
  Prediction.find.mockResolvedValue([prediction()]);
  FarmerFeedback.find.mockResolvedValue([feedback()]);

  const result = await evaluatePredictions();

  expect(result.evaluatedSamples).toBe(1);
  expect(result.records[0].evaluable).toBe(true);
  expect(result.records[0].actualOutcome).toBe('SPOILAGE');
});

test('incomplete feedback remains unevaluated', async () => {
  Prediction.find.mockResolvedValue([prediction()]);
  FarmerFeedback.find.mockResolvedValue([feedback({ actualSpoilageOutcome: 'Not Reported' })]);

  const result = await evaluatePredictions();

  expect(result.evaluatedSamples).toBe(0);
  expect(result.records[0].evaluable).toBe(false);
});

test('feedback from another farmer is excluded', async () => {
  Prediction.find.mockResolvedValue([prediction()]);
  FarmerFeedback.find.mockResolvedValue([feedback({ farmerId: 'farmer-2' })]);

  const result = await evaluatePredictions();

  expect(result.linkedFeedbackSamples).toBe(0);
  expect(result.records[0].evaluable).toBe(false);
});

test('harvest owned by another farmer is excluded', async () => {
  Prediction.find.mockResolvedValue([prediction()]);
  FarmerFeedback.find.mockResolvedValue([feedback()]);
  Harvest.find.mockResolvedValue([{ _id: harvestId, farmerId: 'farmer-2', crop: 'Tomato', quantity: 10 }]);

  const result = await evaluatePredictions();

  expect(result.linkedFeedbackSamples).toBe(0);
  expect(result.records[0].evaluable).toBe(false);
});

test('model versions and rule-based sources remain separate', async () => {
  Prediction.find.mockResolvedValue([
    prediction(),
    prediction({ _id: 'prediction-2', source: 'rule_based', modelVersion: 'rule_based_v1' }),
  ]);
  FarmerFeedback.find.mockResolvedValue([
    feedback(),
    feedback({ _id: 'feedback-2', predictionId: 'prediction-2' }),
  ]);

  const result = await evaluatePredictions();

  expect(result.bySource).toEqual(expect.arrayContaining([
    expect.objectContaining({ modelSource: 'ml_model', modelVersions: ['spoilage_risk_baseline'] }),
    expect.objectContaining({ modelSource: 'rule_based', modelVersions: ['rule_based_v1'] }),
  ]));
});

test('binary metrics calculate valid spoilage precision, recall, and F1', () => {
  const metrics = calculateBinaryMetrics([
    { predictedLabel: 'SPOILAGE', actualLabel: 'SPOILAGE' },
    { predictedLabel: 'NO_SPOILAGE', actualLabel: 'NO_SPOILAGE' },
    { predictedLabel: 'SPOILAGE', actualLabel: 'NO_SPOILAGE' },
    { predictedLabel: 'NO_SPOILAGE', actualLabel: 'SPOILAGE' },
  ]);

  expect(metrics.available).toBe(true);
  expect(metrics.precision).toBe(0.5);
  expect(metrics.recall).toBe(0.5);
  expect(metrics.f1).toBe(0.5);
});

test('small or one-class samples report insufficient data', () => {
  const metrics = calculateBinaryMetrics([
    { predictedLabel: 'SPOILAGE', actualLabel: 'SPOILAGE' },
  ]);

  expect(metrics.available).toBe(false);
  expect(metrics.message).toBe('Insufficient labeled outcomes for reliable evaluation.');
});

test('evaluation does not mutate prediction or feedback records', async () => {
  const originalPrediction = prediction();
  const originalFeedback = feedback();
  const predictionSnapshot = JSON.stringify(originalPrediction);
  const feedbackSnapshot = JSON.stringify(originalFeedback);
  Prediction.find.mockResolvedValue([originalPrediction]);
  FarmerFeedback.find.mockResolvedValue([originalFeedback]);

  await evaluatePredictions();

  expect(JSON.stringify(originalPrediction)).toBe(predictionSnapshot);
  expect(JSON.stringify(originalFeedback)).toBe(feedbackSnapshot);
});

test('shelf-life evaluation remains unavailable without an endpoint timestamp', async () => {
  Prediction.find.mockResolvedValue([prediction()]);
  FarmerFeedback.find.mockResolvedValue([feedback()]);

  const result = await evaluatePredictions();

  expect(result.shelfLife.labelsAvailable).toBe(0);
  expect(result.shelfLife.reason).toContain('end-of-saleable-life timestamp');
});