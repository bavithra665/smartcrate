const prisma = require('../config/prisma');
const { toApiRecord } = require('../utils/apiRecord');

// GET /api/farmers/profile
const getProfile = async (req, res) => {
  res.json(toApiRecord(req.farmer, { includeVersion: false }));
};

// PUT /api/farmers/profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, location, village, district, state, preferredLanguage } = req.body;
    const updated = await prisma.farmer.update({
      where: { id: req.farmer.id },
      data: { name: name.trim(), location, village, district, state, preferredLanguage },
    });
    res.json(toApiRecord(updated));
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile };
