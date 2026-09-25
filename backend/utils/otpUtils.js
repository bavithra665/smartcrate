const OTP = require('../models/OTP');

/**
 * Generates and stores an OTP for a mobile number.
 * In development: uses DEMO_OTP from .env
 * In production: replace sendSMS() with a real SMS provider (e.g. Twilio, MSG91)
 */
const generateOTP = async (mobile) => {
  const isDev = process.env.NODE_ENV === 'development';
  const otp = isDev ? process.env.DEMO_OTP : Math.floor(1000 + Math.random() * 9000).toString();

  const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRES_MINUTES || 10) * 60 * 1000);

  // Remove any existing unused OTPs for this mobile
  await OTP.deleteMany({ mobile, used: false });

  await OTP.create({ mobile, otp, expiresAt });

  if (!isDev) {
    // TODO: await sendSMS(mobile, `Your SmartCrate OTP is ${otp}. Valid for 10 minutes.`);
    console.log(`[PRODUCTION] OTP for ${mobile} should be sent via SMS provider`);
  } else {
    console.log(`[DEV] OTP for ${mobile}: ${otp}`);
  }

  return otp;
};

const verifyOTP = async (mobile, otp, { consume = true } = {}) => {
  const record = await OTP.findOne({ mobile, used: false });
  if (!record) return { valid: false, message: 'OTP not found or already used' };
  if (new Date() > record.expiresAt) return { valid: false, message: 'OTP has expired' };
  if (record.otp !== otp) return { valid: false, message: 'Invalid OTP' };

  if (consume) {
    record.used = true;
    await record.save();
  }
  return { valid: true };
};

module.exports = { generateOTP, verifyOTP };
