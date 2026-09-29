jest.mock('../config/prisma', () => ({
  otp: { deleteMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
}));

const prisma = require('../config/prisma');
const { generateOTP } = require('../utils/otpUtils');

afterEach(() => {
  jest.clearAllMocks();
});

test('fails closed when production OTP delivery is not configured', async () => {
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    await expect(generateOTP('9876543210')).rejects.toMatchObject({
      message: 'OTP delivery is not configured for this environment',
      statusCode: 503,
    });
    expect(prisma.otp.deleteMany).not.toHaveBeenCalled();
    expect(prisma.otp.create).not.toHaveBeenCalled();
  } finally {
    process.env.NODE_ENV = previousEnvironment;
  }
});

test('expires and consumes OTP records through the Prisma store', async () => {
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const { generateOTP, verifyOTP } = require('../utils/otpUtils');
  prisma.otp.create.mockResolvedValue({ id: 'otp-1' });
  prisma.otp.findFirst.mockResolvedValue({ id: 'otp-1', otp: '1234', expiresAt: new Date(Date.now() + 60_000) });
  prisma.otp.updateMany.mockResolvedValue({ count: 1 });

  try {
    await generateOTP('9876543210');
    expect(prisma.otp.deleteMany).toHaveBeenCalledWith({ where: { mobile: '9876543210', used: false } });
    expect(prisma.otp.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mobile: '9876543210', expiresAt: expect.any(Date) }),
    });
    await expect(verifyOTP('9876543210', '1234')).resolves.toEqual({ valid: true });
    expect(prisma.otp.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'otp-1', used: false }),
      data: { used: true },
    }));
  } finally {
    process.env.NODE_ENV = previousEnvironment;
  }
});

test('cleans expired OTP rows through a PostgreSQL-compatible expiry query', async () => {
  const { cleanupExpiredOtps } = require('../services/otpCleanupService');
  const expiredBefore = new Date();
  prisma.otp.deleteMany.mockResolvedValue({ count: 2 });

  await cleanupExpiredOtps();

  const [{ where }] = prisma.otp.deleteMany.mock.calls[0];
  expect(where.expiresAt.lte).toBeInstanceOf(Date);
  expect(where.expiresAt.lte.getTime()).toBeGreaterThanOrEqual(expiredBefore.getTime());
});