const prisma = require('./prisma');
const otpCleanupService = require('../services/otpCleanupService');

const connectDB = async () => {
  try {
    await prisma.$connect();
    otpCleanupService.start();
    console.log('PostgreSQL connected through Prisma');
  } catch (err) {
    console.error('PostgreSQL connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
