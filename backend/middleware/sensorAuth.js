const crypto = require('crypto');
const Device = require('../models/Device');
const { protect } = require('./auth');

const hashApiKey = (apiKey) => crypto.createHash('sha256').update(apiKey).digest('hex');

const sensorAuth = async (req, res, next) => {
  if (req.body.source === 'simulator') {
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
      return res.status(401).json({ message: 'Simulator sensor submissions are disabled' });
    }
    return protect(req, res, next);
  }

  const { deviceId } = req.body;
  const apiKey = req.get('X-Device-Api-Key');
  if (!deviceId || !apiKey) {
    return res.status(401).json({ message: 'Device id and device API key are required' });
  }

  try {
    const device = await Device.findOne({ deviceId, isActive: true }).select('+apiKeyHash');
    if (!device || !crypto.timingSafeEqual(
      Buffer.from(device.apiKeyHash, 'hex'),
      Buffer.from(hashApiKey(apiKey), 'hex')
    )) {
      return res.status(401).json({ message: 'Unauthorized sensor device' });
    }
    req.sensorDevice = device;
    await Device.updateOne({ _id: device._id }, { lastSeenAt: new Date() });
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { sensorAuth, hashApiKey };
