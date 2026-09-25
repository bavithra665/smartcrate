process.env.NODE_ENV = 'test';

jest.mock('../models/Recommendation', () => ({
  create: jest.fn(),
}));
jest.mock('../models/Prediction', () => ({
  findOne: jest.fn(),
}));
jest.mock('../models/Harvest', () => ({
  findOne: jest.fn(),
}));
jest.mock('../models/Market', () => ({
  find: jest.fn(),
}));
jest.mock('../models/MarketPrice', () => ({
  findOne: jest.fn(),
}));

const Recommendation = require('../models/Recommendation');
const Prediction = require('../models/Prediction');
const Harvest = require('../models/Harvest');
const Market = require('../models/Market');
const MarketPrice = require('../models/MarketPrice');
const recommendationService = require('../services/recommendationService');

const farmerId = '507f1f77bcf86cd799439011';
const otherFarmerId = '507f1f77bcf86cd799439099';
const harvestId = '507f1f77bcf86cd799439012';

const latest = (value) => ({
  sort: jest.fn().mockResolvedValue(value),
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('rejects a harvest that belongs to another farmer', async () => {
  Harvest.findOne.mockResolvedValue(null);

  await expect(recommendationService.generate(harvestId, farmerId))
    .rejects.toThrow('Harvest not found');

  expect(Harvest.findOne).toHaveBeenCalledWith({ _id: harvestId, farmerId });
  expect(Prediction.findOne).not.toHaveBeenCalled();
  expect(Harvest.findOne).not.toHaveBeenCalledWith({ _id: harvestId, farmerId: otherFarmerId });
});

test('scores net value after transport cost and explains the decision', async () => {
  const localMarket = {
    _id: '507f1f77bcf86cd799439021',
    name: 'Local Market',
    distance: 5,
    travelTime: '15 mins',
    travelTimeHours: 0.25,
    transportCost: 0,
    isActive: true,
  };
  const distantMarket = {
    _id: '507f1f77bcf86cd799439022',
    name: 'Distant Market',
    distance: 50,
    travelTime: '2 hrs',
    travelTimeHours: 2,
    transportCost: 1000,
    isActive: true,
  };

  Harvest.findOne.mockResolvedValue({
    _id: harvestId,
    farmerId,
    crop: 'Tomato',
    quantity: 100,
  });
  Prediction.findOne.mockReturnValue(latest({
    _id: '507f1f77bcf86cd799439031',
    harvestId,
    farmerId,
    remainingShelfLife: 5,
    spoilageRisk: 'Low',
  }));
  Market.find.mockResolvedValue([localMarket, distantMarket]);
  MarketPrice.findOne.mockImplementation(({ marketId }) => latest({
    modalPrice: marketId === localMarket._id ? 12 : 20,
  }));
  Recommendation.create.mockImplementation(async (data) => data);

  const recommendation = await recommendationService.generate(harvestId, farmerId);

  expect(recommendation.action).toBe('Sell Today');
  expect(recommendation.bestMarketId).toBe(localMarket._id);
  expect(recommendation.marketsConsidered[0].netValue).toBe(1200);
  expect(recommendation.marketsConsidered[1].netValue).toBe(1000);
  expect(recommendation.reasons).toEqual(expect.arrayContaining([
    'Minimal transport cost',
  ]));
  expect(Recommendation.create).toHaveBeenCalledWith(expect.objectContaining({
    harvestId,
    farmerId,
    action: 'Sell Today',
  }));
});
