const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp, register, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
	sendOtpValidators,
	verifyOtpValidators,
	registerValidators,
} = require('../validators/requestValidators');

router.post('/send-otp', sendOtpValidators, validate, sendOtp);
router.post('/verify-otp', verifyOtpValidators, validate, verifyOtp);
router.post('/register', registerValidators, validate, register);
router.get('/me', protect, getMe);

module.exports = router;
