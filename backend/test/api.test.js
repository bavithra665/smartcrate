process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

jest.mock('../config/prisma', () => {
  const delegate = () => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  });
  return {
    farmer: delegate(),
    device: delegate(),
    harvest: delegate(),
    sensorReading: delegate(),
    prediction: delegate(),
    recommendation: delegate(),
    qualityObservation: delegate(),
    farmerFeedback: delegate(),
    market: delegate(),
    marketPrice: delegate(),
    notification: delegate(),
    otp: delegate(),
  };
});

jest.mock('../services/predictionService', () => ({
  runPrediction: jest.fn().mockResolvedValue(null),
  calculateHoursSinceHarvest: jest.fn().mockReturnValue(1),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const prisma = require('../config/prisma');
const predictionService = require('../services/predictionService');

const farmerId = '507f1f77bcf86cd799439011';
const harvestId = '507f1f77bcf86cd799439012';
const user = { id: farmerId, name: 'Test Farmer', role: 'farmer', isActive: true, location: 'Erode' };
const tokenFor = (id = farmerId) => jwt.sign({ id }, process.env.JWT_SECRET);
const auth = (id = farmerId) => ({ Authorization: `Bearer ${tokenFor(id)}` });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.farmer.findUnique.mockResolvedValue(user);
  prisma.device.update.mockResolvedValue(null);
  prisma.otp.deleteMany.mockResolvedValue({ count: 0 });
  prisma.harvest.findMany.mockResolvedValue([]);
  prisma.farmerFeedback.findMany.mockResolvedValue([]);
  prisma.sensorReading.findMany.mockResolvedValue([]);
  prisma.qualityObservation.findMany.mockResolvedValue([]);
  prisma.prediction.findMany.mockResolvedValue([]);
});

describe('health and authentication', () => {
  test('returns a healthy API response', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBe('smartcrate-api');
  });

  test('rejects invalid OTP request input before persistence', async () => {
    const response = await request(app).post('/api/auth/send-otp').send({ mobile: '123' });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
    expect(prisma.otp.create).not.toHaveBeenCalled();
  });

  test('rejects protected routes without a bearer token', async () => {
    const response = await request(app).get('/api/harvests');
    expect(response.status).toBe(401);
    expect(prisma.harvest.findMany).not.toHaveBeenCalled();
  });

  test('accepts a valid token and returns the legacy _id contract', async () => {
    const response = await request(app).get('/api/farmers/profile').set(auth());
    expect(response.status).toBe(200);
    expect(response.body._id).toBe(farmerId);
    expect(response.body.id).toBeUndefined();
    expect(response.body.__v).toBeUndefined();
    expect(prisma.farmer.findUnique).toHaveBeenCalledWith({ where: { id: farmerId } });
  });

  test('rejects a valid token for an inactive farmer', async () => {
    prisma.farmer.findUnique.mockResolvedValue({ ...user, isActive: false });
    const response = await request(app).get('/api/harvests').set(auth());
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Farmer account is inactive or unavailable');
  });
});

describe('farmer-owned harvests', () => {
  test('rejects invalid harvest input before persistence', async () => {
    const response = await request(app).post('/api/harvests').set(auth()).send({ quantity: -4, harvestDate: 'not-a-date' });
    expect(response.status).toBe(400);
    expect(prisma.harvest.create).not.toHaveBeenCalled();
  });

  test('creates a harvest with an API-compatible identifier and normalized values', async () => {
    prisma.harvest.create.mockImplementation(async ({ data }) => ({ id: harvestId, ...data }));
    const response = await request(app).post('/api/harvests').set(auth()).send({
      crop: 'Tomato', quantity: '20', harvestDate: '2026-09-20', maturityStage: 'Semi-Ripe',
    });
    expect(response.status).toBe(201);
    expect(response.body._id).toBe(harvestId);
    expect(response.body.id).toBeUndefined();
    expect(prisma.harvest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ farmerId, crop: 'Tomato', quantity: 20, maturityStage: 'Semi_Ripe' }),
    });
  });

  test('lists only the authenticated farmer harvests', async () => {
    prisma.harvest.findMany.mockResolvedValue([{ id: harvestId, farmerId, crop: 'Tomato' }]);
    const response = await request(app).get('/api/harvests').set(auth());
    expect(response.status).toBe(200);
    expect(response.body[0]._id).toBe(harvestId);
    expect(prisma.harvest.findMany).toHaveBeenCalledWith({
      where: { farmerId }, orderBy: { createdAt: 'desc' },
    });
  });

  test('does not update a harvest outside the farmer scope', async () => {
    prisma.harvest.findFirst.mockResolvedValue(null);
    const response = await request(app).put(`/api/harvests/${harvestId}`).set(auth()).send({ crop: 'Onion' });
    expect(response.status).toBe(404);
    expect(prisma.harvest.update).not.toHaveBeenCalled();
  });

  test('accepts quality observations with compound-unique lookup', async () => {
    prisma.harvest.findFirst.mockResolvedValue({ id: harvestId, farmerId, harvestDate: new Date('2026-09-20') });
    prisma.qualityObservation.findUnique.mockResolvedValue(null);
    prisma.qualityObservation.findFirst.mockResolvedValue(null);
    prisma.qualityObservation.create.mockImplementation(async ({ data }) => ({ id: '507f1f77bcf86cd799439013', ...data }));
    const response = await request(app)
      .post(`/api/harvests/${harvestId}/quality-observations`).set(auth())
      .send({ saleabilityStatus: 'SALEABLE', observedAt: '2026-09-21T10:00:00.000Z' });
    expect(response.status).toBe(201);
    expect(response.body._id).toBe('507f1f77bcf86cd799439013');
    expect(prisma.qualityObservation.findUnique).toHaveBeenCalledWith({
      where: { harvestId_observedAt: { harvestId, observedAt: new Date('2026-09-21T10:00:00.000Z') } },
    });
  });
});

describe('sensor authentication and deduplication', () => {
  const observedAt = '2026-01-01T09:00:00.000Z';

  test('stores simulator readings for an owned harvest and triggers prediction', async () => {
    prisma.harvest.findUnique.mockResolvedValue({ id: harvestId, farmerId });
    prisma.sensorReading.create.mockImplementation(async ({ data }) => ({ id: '507f1f77bcf86cd799439013', ...data }));
    const response = await request(app).post('/api/sensors/readings').set(auth()).send({
      source: 'simulator', harvestId, temperature: '25', humidity: '60', observedAt,
    });
    expect(response.status).toBe(201);
    expect(response.body._id).toBe('507f1f77bcf86cd799439013');
    expect(prisma.sensorReading.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ harvestId, farmerId, temperature: 25, humidity: 60, timestamp: new Date(observedAt) }),
    });
    expect(predictionService.runPrediction).toHaveBeenCalled();
  });

  test('returns duplicate hardware readings without storing or predicting again', async () => {
    const crypto = require('crypto');
    prisma.device.findFirst.mockResolvedValue({
      id: '507f1f77bcf86cd799439014', deviceId: 'SC-ESP32-001', farmerId,
      apiKeyHash: crypto.createHash('sha256').update('device-secret').digest('hex'),
    });
    prisma.harvest.findUnique.mockResolvedValue({ id: harvestId, farmerId });
    prisma.sensorReading.findUnique.mockResolvedValue({ id: '507f1f77bcf86cd799439015', harvestId, timestamp: new Date(observedAt) });
    const response = await request(app).post('/api/sensors/readings')
      .set('X-Device-Api-Key', 'device-secret')
      .send({ deviceId: 'SC-ESP32-001', harvestId, temperature: 25, humidity: 60, observedAt });
    expect(response.status).toBe(200);
    expect(response.body.duplicate).toBe(true);
    expect(prisma.sensorReading.create).not.toHaveBeenCalled();
    expect(predictionService.runPrediction).not.toHaveBeenCalled();
  });

  test('rejects unknown hardware devices before reading the harvest', async () => {
    prisma.device.findFirst.mockResolvedValue(null);
    const response = await request(app).post('/api/sensors/readings')
      .set('X-Device-Api-Key', 'bad-key')
      .send({ deviceId: 'SC-ESP32-001', harvestId, temperature: 25, humidity: 60, observedAt });
    expect(response.status).toBe(401);
    expect(prisma.harvest.findUnique).not.toHaveBeenCalled();
  });
});

describe('feedback and notifications', () => {
  test('persists feedback in the authenticated farmer scope and maps enum strings', async () => {
    prisma.harvest.findFirst.mockResolvedValue({ id: harvestId, farmerId, quantity: 50 });
    prisma.farmerFeedback.create.mockImplementation(async ({ data }) => ({ id: '507f1f77bcf86cd799439016', ...data }));
    const response = await request(app).post('/api/feedback').set(auth()).send({
      harvestId, actualSaleStatus: 'Not Sold', actualSpoilageOutcome: 'No Spoilage', soldQuantity: 10,
    });
    expect(response.status).toBe(201);
    expect(response.body.actualSaleStatus).toBe('Not Sold');
    expect(prisma.farmerFeedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ farmerId, actualSaleStatus: 'Not_Sold', actualSpoilageOutcome: 'No_Spoilage' }),
    });
  });

  test('lists notifications only for the authenticated farmer', async () => {
    prisma.notification.findMany.mockResolvedValue([{ id: '507f1f77bcf86cd799439017', farmerId, read: false }]);
    const response = await request(app).get('/api/notifications').set(auth());
    expect(response.status).toBe(200);
    expect(response.body[0]._id).toBe('507f1f77bcf86cd799439017');
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { farmerId }, orderBy: { createdAt: 'desc' }, take: 50,
    });
  });

  test('marks a notification read only after checking farmer ownership', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: '507f1f77bcf86cd799439018', farmerId });
    prisma.notification.update.mockResolvedValue({ id: '507f1f77bcf86cd799439018', farmerId, read: true });
    const response = await request(app).put('/api/notifications/507f1f77bcf86cd799439018/read').set(auth());
    expect(response.status).toBe(200);
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: '507f1f77bcf86cd799439018', farmerId },
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: '507f1f77bcf86cd799439018' }, data: { read: true },
    });
  });
});

test('shelf-life readiness remains admin-only and retains its data gate', async () => {
  prisma.farmer.findUnique.mockResolvedValue({ ...user, role: 'admin' });
  const response = await request(app).get('/api/admin/ml-data-readiness').set(auth());
  expect(response.status).toBe(200);
  expect(response.body.shelfLifeRegressionTrainingJustified).toBe(false);
  expect(response.body.validShelfLifeTrainingRows).toBe(0);
  expect(response.body.minimumValidTrainingRows).toBe(30);
  expect(response.body.distinctTrainingBatches).toBe(0);
  expect(response.body.minimumDistinctHarvestBatches).toBe(10);
});