const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/farmerController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { profileValidators } = require('../validators/requestValidators');

router.get('/profile', protect, getProfile);
router.put('/profile', protect, profileValidators, validate, updateProfile);

module.exports = router;
