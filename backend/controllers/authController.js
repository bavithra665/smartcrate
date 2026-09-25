const Farmer = require('../models/Farmer');
const { generateOTP, verifyOTP } = require('../utils/otpUtils');
const { generateToken } = require('../utils/generateToken');

// POST /api/auth/send-otp
const sendOtp = async (req, res, next) => {
  try {
    const { mobile } = req.body;
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: 'Valid 10-digit mobile number required' });
    }
    await generateOTP(mobile);
    const isDev = process.env.NODE_ENV === 'development';
    res.json({
      message: `OTP sent to +91 ${mobile}`,
      ...(isDev && { devNote: `Demo OTP: ${process.env.DEMO_OTP}` }),
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/verify-otp  (login existing farmer)
const verifyOtp = async (req, res, next) => {
  try {
    const { mobile, otp } = req.body;
    const result = await verifyOTP(mobile, otp, { consume: false });
    if (!result.valid) return res.status(400).json({ message: result.message });

    const farmer = await Farmer.findOne({ mobile });
    if (!farmer) {
      // Farmer not registered yet — tell frontend to show registration
      return res.status(404).json({ message: 'Farmer not registered', needsRegistration: true, mobile });
    }

    await verifyOTP(mobile, otp);
    const token = generateToken(farmer._id);
    res.json({ token, farmer });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/register  (register new farmer after OTP verified)
const register = async (req, res, next) => {
  try {
    const { mobile, otp, name, location, village, district, state, preferredLanguage } = req.body;

    const result = await verifyOTP(mobile, otp);
    if (!result.valid) return res.status(400).json({ message: result.message });

    const existing = await Farmer.findOne({ mobile });
    if (existing) return res.status(400).json({ message: 'Mobile number already registered' });

    const farmer = await Farmer.create({ mobile, name, location, village, district, state, preferredLanguage });
    const token = generateToken(farmer._id);
    res.status(201).json({ token, farmer });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json(req.farmer);
};

module.exports = { sendOtp, verifyOtp, register, getMe };
