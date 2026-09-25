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
  body('temperature').optional({ values: 'falsy' }).isFloat({ min: -50, max: 100 }),
  body('humidity').optional({ values: 'falsy' }).isFloat({ min: 0, max: 100 }),
  body('ethylene').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('voc').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('co2').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('currentWeight').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('deviceId').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
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
  body('marketId').isMongoId().withMessage('marketId must be a valid MongoDB id'),
  body('crop').trim().notEmpty().withMessage('crop is required').isLength({ max: 100 }),
  body('variety').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('date').isISO8601({ strict: true }).withMessage('date must be an ISO date'),
  body('minPrice').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('maxPrice').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('modalPrice').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('arrivalQuantity').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('unit').isIn(['kg', 'quintal', 'tonne']).withMessage('unit must be kg, quintal, or tonne'),
  body('source').optional().isIn(['dataset', 'api', 'manual']),
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
  body('actualSellingPrice').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('actualMarket').optional({ values: 'falsy' }).trim().isLength({ max: 150 }),
  body('actualSpoilageOutcome').optional().isIn(['No Spoilage', 'Partial Spoilage', 'Full Spoilage', 'Not Reported']),
  body('recommendationHelpful').optional().isBoolean(),
  body('predictionAccurate').optional().isBoolean(),
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
