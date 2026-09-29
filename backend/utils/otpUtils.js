const prisma = require('../config/prisma');

/**
 * Generates and stores an OTP for a mobile number.
 * In development: uses DEMO_OTP from .env
 * In production: replace sendSMS() with a real SMS provider (e.g. Twilio, MSG91)
 */
const generateOTP = async (mobile) => {
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev && process.env.NODE_ENV !== 'test') {
    const error = new Error('OTP delivery is not configured for this environment');
    error.statusCode = 503;
    throw error;
  }

  const otp = isDev ? process.env.DEMO_OTP : Math.floor(1000 + Math.random() * 9000).toString();

  const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRES_MINUTES || 10) * 60 * 1000);

  // Remove any existing unused OTPs for this mobile
  await prisma.otp.deleteMany({ where: { mobile, used: false } });

  await prisma.otp.create({ data: { mobile, otp, expiresAt } });

  if (isDev) {
    console.log(`[DEV] OTP for ${mobile}: ${otp}`);
  }

  return otp;
};

const verifyOTP = async (mobile, otp, { consume = true } = {}) => {
  const record = await prisma.otp.findFirst({ where: { mobile, used: false } });
  if (!record) return { valid: false, message: 'OTP not found or already used' };
  if (new Date() > record.expiresAt) return { valid: false, message: 'OTP has expired' };
  if (record.otp !== otp) return { valid: false, message: 'Invalid OTP' };

  if (consume) {
    const result = await prisma.otp.updateMany({
      where: { id: record.id, used: false, expiresAt: { gt: new Date() } },
      data: { used: true },
    });
    if (result.count === 0) return { valid: false, message: 'OTP not found or already used' };
  }
  return { valid: true };
};

module.exports = { generateOTP, verifyOTP };
