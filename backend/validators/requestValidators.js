const { body, param, query } = require('express-validator');

const mongoId = (field) => param(field).isMongoId().withMessage(`${field} must be a valid MongoDB id`);

const mobile = body('mobile')
  .matches(/^\d{10}$/)
  .withMessage('mobile must be a valid 10-digit number');

const otp = body('otp')
  .matches(/^\d{4,6}$/)
  .withMessage('otp must contain 4 to 6 digits');

const sendOtpValidators = [mobile];

const verifyOtpValidators = [mobile, otp];

const registerValidators = [
  mobile,
  otp,
  body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 100 }),
  body('location').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('village').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('district').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('state').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('preferredLanguage').optional({ values: 'falsy' }).trim().isLength({ max: 50 }),
];

const harvestFields = [
  body('crop').trim().notEmpty().withMessage('crop is required').isLength({ max: 100 }),
  body('variety').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('quantity').isFloat({ min: 0 }).withMessage('quantity must be a non-negative number'),
  body('unit').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
  body('initialWeight').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('harvestDate').isISO8601({ strict: true }).withMessage('harvestDate must be an ISO date'),
  body('harvestTime').optional({ values: 'falsy' }).matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('harvestTime must use HH:mm format'),
  body('maturityStage').optional({ values: 'falsy' }).isIn(['Immature', 'Mature', 'Semi-Ripe', 'Fully Ripe', 'Over-Ripe']),
  body('storageType').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('storageCondition').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('farmerLocation').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
];

const createHarvestValidators = harvestFields;

const updateHarvestValidators = [
  mongoId('id'),
  body('crop').optional().trim().notEmpty().isLength({ max: 100 }),
  body('variety').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('quantity').optional().isFloat({ min: 0 }),
  body('unit').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
  body('initialWeight').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('harvestDate').optional().isISO8601({ strict: true }),
  body('harvestTime').optional({ values: 'falsy' }).matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('maturityStage').optional({ values: 'falsy' }).isIn(['Immature', 'Mature', 'Semi-Ripe', 'Fully Ripe', 'Over-Ripe']),
  body('storageType').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('storageCondition').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('farmerLocation').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
  body('status').optional().isIn(['Active', 'Sold', 'Spoiled', 'Archived']),
];

const harvestIdValidators = [mongoId('id')];

const sensorReadingValidators = [
  body('harvestId').isMongoId().withMessage('harvestId must be a valid MongoDB id'),
  body('source').optional().isIn(['esp32', 'manual', 'simulator']),
  body('temperature').isFloat({ min: 15, max: 40 }).withMessage('temperature must be between 15 and 40 °C'),
  body('humidity').isFloat({ min: 30, max: 95 }).withMessage('humidity must be between 30 and 95%'),
  body('ethylene').optional({ values: 'falsy' }).isFloat({ min: 0.066, max: 15 }).withMessage('ethylene must be between 0.066 and 15 ppm when provided'),
  body('voc').optional({ values: 'falsy' }).isFloat({ min: 0.1, max: 6.02 }).withMessage('voc must be between 0.1 and 6.02'),
  body('co2').optional({ values: 'falsy' }).isFloat({ min: 300, max: 5000 }).withMessage('co2 must be between 300 and 5000 ppm'),
  body('currentWeight').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('deviceId').optional({ values: 'falsy' }).trim().matches(/^[A-Za-z0-9._-]{3,100}$/).withMessage('deviceId has an invalid format'),
  body('observedAt').optional().isISO8601({ strict: true }).withMessage('observedAt must be an ISO-8601 timestamp'),
];

const sensorHarvestValidators = [mongoId('harvestId')];

const marketIdValidators = [mongoId('id')];

const marketValidators = [
  body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 150 }),
  body('location').trim().notEmpty().withMessage('location is required').isLength({ max: 200 }),
  body('district').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('state').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('marketType').optional().isIn(['APMC', 'Local', 'Wholesale', 'Retail', 'Other']),
  body('distance').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('travelTime').optional({ values: 'falsy' }).trim().isLength({ max: 50 }),
  body('travelTimeHours').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('transportCost').optional({ values: 'falsy' }).isFloat({ min: 0 }),
];

const marketPriceValidators = [
  body('marketId').optional({ values: 'falsy' }).isMongoId().withMessage('marketId must be a valid MongoDB id'),
  body('crop').trim().notEmpty().withMessage('crop is required').isLength({ max: 100 }),
  body('price').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('price must be a non-negative number'),
  body('variety').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('date').optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('date must be an ISO date'),
  body('observedAt').optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('observedAt must be an ISO-8601 timestamp'),
  body('minPrice').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('maxPrice').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('modalPrice').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('arrivalQuantity').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('unit').isIn(['kg', 'quintal', 'tonne']).withMessage('unit must be kg, quintal, or tonne'),
  body('currency').optional({ values: 'falsy' }).trim().isLength({ min: 2, max: 10 }).withMessage('currency must be a valid ISO-style currency code'),
  body('source').optional().isIn(['dataset', 'api', 'manual', 'mock', 'development']),
  body('metadata').optional({ values: 'falsy' }).isObject().withMessage('metadata must be an object when provided'),
];

const marketPriceQueryValidators = [
  query('crop').trim().notEmpty().withMessage('crop query param required'),
];

const recommendationGenerateValidators = [
  body('harvestId').isMongoId().withMessage('harvestId must be a valid MongoDB id'),
];

const recommendationHarvestValidators = [mongoId('harvestId')];

const feedbackValidators = [
  body('harvestId').isMongoId().withMessage('harvestId must be a valid MongoDB id'),
  body('predictionId').optional({ values: 'falsy' }).isMongoId(),
  body('recommendationId').optional({ values: 'falsy' }).isMongoId(),
  body('farmerAction').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('actualSaleStatus').optional().isIn(['Sold', 'Not Sold', 'Spoiled', 'Stored', 'Discarded', 'Not Reported']),
  body('actualSellingPrice').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('actualMarket').optional({ values: 'falsy' }).trim().isLength({ max: 150 }),
  body('soldQuantity').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('spoiledQuantity').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('actualSpoilageOutcome').optional().isIn(['No Spoilage', 'Partial Spoilage', 'Full Spoilage', 'Not Reported']),
  body('actualQuality').optional().isIn(['Excellent', 'Good', 'Fair', 'Poor', 'Not Reported']),
  body('recommendationHelpful').optional().isBoolean(),
  body('recommendationFollowed').optional().isBoolean(),
  body('predictionAccurate').optional().isBoolean(),
  body('observedAt').optional().isISO8601({ strict: true }).withMessage('observedAt must be an ISO-8601 timestamp'),
  body('comments').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
];

const profileValidators = [
  body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 100 }),
  body('location').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('village').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('district').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('state').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('preferredLanguage').optional({ values: 'falsy' }).trim().isLength({ max: 50 }),
];

module.exports = {
  sendOtpValidators,
  verifyOtpValidators,
  registerValidators,
  createHarvestValidators,
  updateHarvestValidators,
  harvestIdValidators,
  sensorReadingValidators,
  sensorHarvestValidators,
  marketIdValidators,
  marketValidators,
  marketPriceValidators,
  marketPriceQueryValidators,
  recommendationGenerateValidators,
  recommendationHarvestValidators,
  feedbackValidators,
  profileValidators,
};
