const prisma = require('../config/prisma');

let cleanupTimer;

const cleanupExpiredOtps = () => prisma.otp.deleteMany({
  where: { expiresAt: { lte: new Date() } },
});

const start = () => {
  if (cleanupTimer) return;
  cleanupExpiredOtps().catch((error) => {
    console.error('[OtpCleanup] Expired OTP cleanup failed:', error.message);
  });
  cleanupTimer = setInterval(() => {
    cleanupExpiredOtps().catch((error) => {
      console.error('[OtpCleanup] Expired OTP cleanup failed:', error.message);
    });
  }, 60_000);
  cleanupTimer.unref();
};

const stop = () => {
  if (!cleanupTimer) return;
  clearInterval(cleanupTimer);
  cleanupTimer = undefined;
};

module.exports = { start, stop, cleanupExpiredOtps };