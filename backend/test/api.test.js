process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

jest.mock('../models/Farmer', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));
jest.mock('../models/Harvest', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
}));
jest.mock('../models/Prediction', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
}));
jest.mock('../models/Recommendation', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../models/SensorReading', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));
jest.mock('../models/Device', () => ({
  findOne: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../models/FarmerFeedback', () => ({
  create: jest.fn(),
  find: jest.fn(),
}));
jest.mock('../models/Market', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../models/MarketPrice', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  aggregate: jest.fn(),
  create: jest.fn(),
  populate: jest.fn(),
}));
jest.mock('../models/Notification', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../models/OTP', () => ({
  deleteMany: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock('../services/predictionService', () => ({
  runPrediction: jest.fn().mockResolvedValue(null),
  calculateHoursSinceHarvest: jest.fn().mockReturnValue(1),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Farmer = require('../models/Farmer');
const Harvest = require('../models/Harvest');
const Prediction = require('../models/Prediction');
const Recommendation = require('../models/Recommendation');
const SensorReading = require('../models/SensorReading');
const Device = require('../models/Device');
const FarmerFeedback = require('../models/FarmerFeedback');
const Market = require('../models/Market');
const MarketPrice = require('../models/MarketPrice');

const farmerId = '507f1f77bcf86cd799439011';
const harvestId = '507f1f77bcf86cd799439012';
const user = { _id: farmerId, name: 'Test Farmer', role: 'farmer', location: 'Erode' };
const tokenFor = (id = farmerId) => jwt.sign({ id }, process.env.JWT_SECRET);
const auth = (id = farmerId) => ({ Authorization: `Bearer ${tokenFor(id)}` });

const sortedQuery = (value) => ({
  sort: jest.fn().mockResolvedValue(value),
});

beforeEach(() => {
  jest.clearAllMocks();
  Farmer.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue(user),
  });
  Device.updateOne.mockResolvedValue(null);
});

describe('health and authentication protection', () => {
  test('returns a healthy API response', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBe('smartcrate-api');
  });

  test('rejects invalid OTP request input before the controller', async () => {
    const response = await request(app)
      .post('/api/auth/send-otp')
      .send({ mobile: '123' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
  });

  test('rejects protected routes without a bearer token', async () => {
    const response = await request(app).get('/api/harvests');

    expect(response.status).toBe(401);
    expect(Harvest.find).not.toHaveBeenCalled();
  });

  test('accepts a valid token and scopes harvest listing to the farmer', async () => {
    Harvest.find.mockReturnValue(sortedQuery([]));

    const response = await request(app)
      .get('/api/harvests')
      .set(auth());

    expect(response.status).toBe(200);
    expect(Harvest.find).toHaveBeenCalledWith({ farmerId });
  });
});

describe('harvest validation, ownership, and update allowlist', () => {
  test('rejects an invalid harvest payload', async () => {
    const response = await request(app)
      .post('/api/harvests')
      .set(auth())
      .send({ quantity: -4, harvestDate: 'not-a-date' });

    expect(response.status).toBe(400);
    expect(Harvest.create).not.toHaveBeenCalled();
  });

  test('creates a valid harvest for the authenticated farmer', async () => {
    Harvest.create.mockResolvedValue({ _id: harvestId, farmerId, crop: 'Tomato' });

    const response = await request(app)
      .post('/api/harvests')
      .set(auth())
      .send({
        crop: 'Tomato',
        quantity: 25,
        harvestDate: '2026-09-25',
      });

    expect(response.status).toBe(201);
    expect(Harvest.create).toHaveBeenCalledWith(expect.objectContaining({
      farmerId,
      crop: 'Tomato',
      quantity: 25,
    }));
  });

  test('prevents access to another farmer harvest', async () => {
    Harvest.findOne.mockResolvedValue(null);

    const response = await request(app)
      .get(`/api/harvests/${harvestId}`)
      .set(auth());

    expect(response.status).toBe(404);
    expect(Harvest.findOne).toHaveBeenCalledWith({ _id: harvestId, farmerId });
  });

  test('allows only approved fields during harvest updates', async () => {
    Harvest.findOneAndUpdate.mockResolvedValue({ _id: harvestId, farmerId, crop: 'Onion' });

    const response = await request(app)
      .put(`/api/harvests/${harvestId}`)
      .set(auth())
      .send({ crop: 'Onion', farmerId: '507f1f77bcf86cd799439099', role: 'admin' });

    expect(response.status).toBe(200);
    expect(Harvest.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: harvestId, farmerId },
      { crop: 'Onion' },
      { new: true, runValidators: true }
    );
  });
});

describe('prediction and recommendation ownership', () => {
  test('scopes latest prediction by harvest and authenticated farmer', async () => {
    Prediction.findOne.mockReturnValue(sortedQuery(null));

    const response = await request(app)
      .get(`/api/predictions/${harvestId}/latest`)
      .set(auth());

    expect(response.status).toBe(404);
    expect(Prediction.findOne).toHaveBeenCalledWith({ harvestId, farmerId });
  });

  test('rejects recommendation generation without a valid harvest id', async () => {
    const response = await request(app)
      .post('/api/recommendations/generate')
      .set(auth())
      .send({ harvestId: 'invalid-id' });

    expect(response.status).toBe(400);
  });

  test('scopes latest recommendation by harvest and authenticated farmer', async () => {
    const query = {
      where: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue(null),
    };
    Recommendation.findOne.mockReturnValue(query);

    const response = await request(app)
      .get(`/api/recommendations/${harvestId}/latest`)
      .set(auth());

    expect(response.status).toBe(404);
    expect(Recommendation.findOne).toHaveBeenCalledWith({ harvestId });
    expect(query.where).toHaveBeenCalledWith({ farmerId });
  });
});

describe('sensor and feedback validation', () => {
  test('rejects sensor readings outside valid ranges', async () => {
    const response = await request(app)
      .post('/api/sensors/readings')
      .send({ harvestId, temperature: 25, humidity: 140 });

    expect(response.status).toBe(400);
    expect(Harvest.findById).not.toHaveBeenCalled();
  });

  test('accepts valid sensor readings without touching production data', async () => {
    Harvest.findById.mockResolvedValue({ _id: harvestId, farmerId });
    SensorReading.create.mockResolvedValue({ _id: '507f1f77bcf86cd799439013', harvestId });

    const response = await request(app)
      .post('/api/sensors/readings')
      .set(auth())
      .send({ harvestId, source: 'simulator', temperature: 25, humidity: 60, voc: 1.2 });

    expect(response.status).toBe(201);
    expect(SensorReading.create).toHaveBeenCalledWith(expect.objectContaining({
      harvestId,
      temperature: 25,
      humidity: 60,
    }));
  });

  test('accepts an authorized hardware device submission with optional fields omitted', async () => {
    const device = { _id: 'device-1', deviceId: 'SC-ESP32-001', farmerId, apiKeyHash: require('crypto').createHash('sha256').update('device-secret').digest('hex') };
    Device.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(device) });
    Harvest.findById.mockResolvedValue({ _id: harvestId, farmerId });
    SensorReading.findOne.mockResolvedValue(null);
    SensorReading.create.mockResolvedValue({ _id: 'reading-hardware', harvestId });

    const response = await request(app)
      .post('/api/sensors/readings')
      .set('X-Device-Api-Key', 'device-secret')
      .send({ deviceId: 'SC-ESP32-001', harvestId, temperature: 25, humidity: 60 });

    expect(response.status).toBe(201);
    expect(SensorReading.create).toHaveBeenCalledWith(expect.objectContaining({
      deviceId: 'SC-ESP32-001',
      source: 'esp32',
    }));
  });

  test('rejects an unauthorized hardware device', async () => {
    Device.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    const response = await request(app)
      .post('/api/sensors/readings')
      .set('X-Device-Api-Key', 'wrong-secret')
      .send({ deviceId: 'SC-ESP32-001', harvestId, temperature: 25, humidity: 60 });

    expect(response.status).toBe(401);
    expect(Harvest.findById).not.toHaveBeenCalled();
  });

  test('rejects a device owned by a different farmer', async () => {
    const device = { _id: 'device-1', deviceId: 'SC-ESP32-001', farmerId: '507f1f77bcf86cd799439099', apiKeyHash: require('crypto').createHash('sha256').update('device-secret').digest('hex') };
    Device.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(device) });
    Harvest.findById.mockResolvedValue({ _id: harvestId, farmerId });

    const response = await request(app)
      .post('/api/sensors/readings')
      .set('X-Device-Api-Key', 'device-secret')
      .send({ deviceId: 'SC-ESP32-001', harvestId, temperature: 25, humidity: 60 });

    expect(response.status).toBe(403);
  });

  test('rejects future observations', async () => {
    Harvest.findById.mockResolvedValue({ _id: harvestId, farmerId });

    const response = await request(app)
      .post('/api/sensors/readings')
      .set(auth())
      .send({ harvestId, source: 'simulator', temperature: 25, humidity: 60, observedAt: '2999-01-01T00:00:00.000Z' });

    expect(response.status).toBe(400);
  });

  test('always uses the authenticated farmer id for feedback', async () => {
    FarmerFeedback.create.mockResolvedValue({ _id: 'feedback-1', farmerId });

    const response = await request(app)
      .post('/api/feedback')
      .set(auth())
      .send({
        harvestId,
        farmerId: '507f1f77bcf86cd799439099',
        actualSellingPrice: 20,
      });

    expect(response.status).toBe(201);
    expect(FarmerFeedback.create).toHaveBeenCalledWith(expect.objectContaining({
      farmerId,
      harvestId,
      actualSellingPrice: 20,
    }));
    expect(FarmerFeedback.create.mock.calls[0][0].farmerId).not.toBe('507f1f77bcf86cd799439099');
  });

  test('rejects unsupported market price units for an admin request', async () => {
    Farmer.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ ...user, role: 'admin' }),
    });

    const response = await request(app)
      .post('/api/markets/prices')
      .set(auth())
      .send({
        marketId: '507f1f77bcf86cd799439021',
        crop: 'Tomato',
        date: '2026-09-25',
        unit: 'crate',
      });

    expect(response.status).toBe(400);
    expect(MarketPrice.create).not.toHaveBeenCalled();
  });
});

describe('market intelligence layer', () => {
  test('returns active markets for the authenticated farmer', async () => {
    Market.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        {
          _id: '507f1f77bcf86cd799439021',
          name: 'Erode APMC Market',
          location: 'Erode, Tamil Nadu',
          district: 'Erode',
          state: 'Tamil Nadu',
          isActive: true,
          distance: 12,
          travelTime: '30 mins',
          transportCost: 150,
        },
      ]),
    });

    const response = await request(app)
      .get('/api/markets')
      .set(auth());

    expect(response.status).toBe(200);
    expect(response.body[0]).toEqual(expect.objectContaining({
      name: 'Erode APMC Market',
      location: 'Erode, Tamil Nadu',
      distance: 12,
    }));
  });

  test('returns the latest crop price with normalized currency and timestamp fields', async () => {
    const latest = [
      {
        _id: '507f1f77bcf86cd799439021',
        marketId: { _id: '507f1f77bcf86cd799439021', name: 'Erode APMC Market' },
        crop: 'Tomato',
        price: 15,
        unit: 'kg',
        currency: 'INR',
        observedAt: '2026-09-25T09:00:00.000Z',
        source: 'mock',
        toObject: () => ({
          _id: '507f1f77bcf86cd799439021',
          marketId: { _id: '507f1f77bcf86cd799439021', name: 'Erode APMC Market' },
          crop: 'Tomato',
          price: 15,
          unit: 'kg',
          currency: 'INR',
          observedAt: '2026-09-25T09:00:00.000Z',
          source: 'mock',
        }),
      },
    ];
    MarketPrice.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(latest) });
    MarketPrice.populate.mockResolvedValue(latest);

    const response = await request(app)
      .get('/api/markets/prices/latest?crop=Tomato')
      .set(auth());

    expect(response.status).toBe(200);
    expect(response.body[0]).toEqual(expect.objectContaining({
      crop: 'Tomato',
      price: 15,
      unit: 'kg',
      currency: 'INR',
      observedAt: '2026-09-25T09:00:00.000Z',
    }));
  });

  test('returns comparison data with price, distance, and travel time for each market', async () => {
    const marketList = [
      {
        _id: '507f1f77bcf86cd799439021',
        name: 'Erode APMC Market',
        location: 'Erode, Tamil Nadu',
        district: 'Erode',
        state: 'Tamil Nadu',
        isActive: true,
        distance: 12,
        travelTime: '30 mins',
        transportCost: 150,
      },
      {
        _id: '507f1f77bcf86cd799439022',
        name: 'Salem Market',
        location: 'Salem, Tamil Nadu',
        district: 'Salem',
        state: 'Tamil Nadu',
        isActive: true,
        distance: 60,
        travelTime: '1.5 hrs',
        transportCost: 400,
      },
    ];

    Market.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(marketList),
    });
    MarketPrice.findOne.mockImplementation(({ marketId, crop }) => ({
      sort: jest.fn().mockResolvedValue({
        marketId,
        crop,
        price: marketId === '507f1f77bcf86cd799439021' ? 15 : 14,
        unit: 'kg',
        currency: 'INR',
        observedAt: '2026-09-25T09:00:00.000Z',
        source: 'mock',
      }),
    }));

    const response = await request(app)
      .get('/api/markets/compare?crop=Tomato')
      .set(auth());

    expect(response.status).toBe(200);
    expect(response.body[0]).toEqual(expect.objectContaining({
      market: 'Erode APMC Market',
      price: 15,
      unit: 'kg',
      currency: 'INR',
      observedAt: '2026-09-25T09:00:00.000Z',
      distance: 12,
      travelTime: '30 mins',
    }));
  });

  test('requires admin access to trigger a market provider sync', async () => {
    const response = await request(app)
      .post('/api/markets/sync')
      .set(auth())
      .send({});

    expect(response.status).toBe(403);
  });
});

describe('admin authorization', () => {
  test('rejects a farmer from admin routes', async () => {
    const response = await request(app)
      .get('/api/admin/stats')
      .set(auth());

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Admin access required');
  });
});
