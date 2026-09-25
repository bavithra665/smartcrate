const express = require('express');
const router = express.Router();
const {
  getMarkets, getMarketPrices, getLatestPricesForCrop,
  createMarket, addMarketPrice, compareMarkets,
} = require('../controllers/marketController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  marketIdValidators,
  marketValidators,
  marketPriceValidators,
  marketPriceQueryValidators,
} = require('../validators/requestValidators');

router.get('/', protect, getMarkets);
router.get('/prices/latest', protect, marketPriceQueryValidators, validate, getLatestPricesForCrop);
router.get('/compare', protect, marketPriceQueryValidators, validate, compareMarkets);
router.get('/:id/prices', protect, marketIdValidators, validate, getMarketPrices);

// Admin-only
router.post('/', protect, adminOnly, marketValidators, validate, createMarket);
router.post('/prices', protect, adminOnly, marketPriceValidators, validate, addMarketPrice);

module.exports = router;
