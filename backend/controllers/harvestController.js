const prisma = require('../config/prisma');
const { toApiRecord, toApiRecords, toPrismaData } = require('../utils/apiRecord');

const harvestUpdateFields = [
  'crop', 'variety', 'quantity', 'unit', 'initialWeight',
  'harvestDate', 'harvestTime', 'maturityStage', 'storageType',
  'storageCondition', 'farmerLocation', 'notes', 'status',
];

// POST /api/harvests
const createHarvest = async (req, res, next) => {
  try {
    const {
      crop, variety, quantity, unit, initialWeight,
      harvestDate, harvestTime, maturityStage,
      storageType, storageCondition, farmerLocation, notes,
    } = req.body;

    const harvest = await prisma.harvest.create({
      data: toPrismaData({
      farmerId: req.farmer.id,
      crop, variety, quantity, unit, initialWeight,
      harvestDate, harvestTime, maturityStage,
      storageType, storageCondition,
      farmerLocation: farmerLocation || req.farmer.location,
      notes,
      }),
    });

    res.status(201).json(toApiRecord(harvest));
  } catch (err) {
    next(err);
  }
};

// GET /api/harvests  (farmer's own harvests)
const getHarvests = async (req, res, next) => {
  try {
    const { status } = req.query;
    if (status && !['Active', 'Sold', 'Spoiled', 'Archived'].includes(status)) return res.json([]);
    const harvests = await prisma.harvest.findMany({
      where: { farmerId: req.farmer.id, ...(status && { status }) },
      orderBy: { createdAt: 'desc' },
    });
    res.json(toApiRecords(harvests));
  } catch (err) {
    next(err);
  }
};

// GET /api/harvests/:id
const getHarvest = async (req, res, next) => {
  try {
    const harvest = await prisma.harvest.findFirst({ where: { id: req.params.id, farmerId: req.farmer.id } });
    if (!harvest) return res.status(404).json({ message: 'Harvest not found' });
    res.json(toApiRecord(harvest));
  } catch (err) {
    next(err);
  }
};

// PUT /api/harvests/:id
const updateHarvest = async (req, res, next) => {
  try {
    const updates = Object.fromEntries(
      harvestUpdateFields
        .filter((field) => Object.prototype.hasOwnProperty.call(req.body, field))
        .map((field) => [field, req.body[field]])
    );

    const owned = await prisma.harvest.findFirst({ where: { id: req.params.id, farmerId: req.farmer.id } });
    const harvest = owned
      ? await prisma.harvest.update({ where: { id: owned.id }, data: toPrismaData(updates) })
      : null;
    if (!harvest) return res.status(404).json({ message: 'Harvest not found' });
    res.json(toApiRecord(harvest));
  } catch (err) {
    next(err);
  }
};

// POST /api/harvests/:id/quality-observations
const submitQualityObservation = async (req, res, next) => {
  try {
    const harvest = await prisma.harvest.findFirst({ where: { id: req.params.id, farmerId: req.farmer.id } });
    if (!harvest) return res.status(404).json({ message: 'Harvest not found' });

    const observedAt = new Date(req.body.observedAt);
    if (Number.isNaN(observedAt.getTime())) {
      return res.status(400).json({ message: 'observedAt must be a valid ISO-8601 timestamp' });
    }
    if (observedAt.getTime() > Date.now()) {
      return res.status(400).json({ message: 'observedAt cannot be in the future' });
    }

    const harvestDate = harvest.harvestDate ? new Date(harvest.harvestDate) : null;
    if (harvestDate && Number.isFinite(harvestDate.getTime()) && observedAt.getTime() < harvestDate.getTime()) {
      return res.status(400).json({ message: 'observedAt cannot precede the harvest timestamp' });
    }

    const existingByTimestamp = await prisma.qualityObservation.findUnique({
      where: { harvestId_observedAt: { harvestId: harvest.id, observedAt } },
    });
    if (existingByTimestamp) {
      return res.status(409).json({ message: 'A quality observation already exists for this timestamp' });
    }

    const existingEndpoint = await prisma.qualityObservation.findFirst({
      where: { harvestId: harvest.id, isEndOfSaleableLife: true },
      orderBy: { observedAt: 'desc' },
    });

    const isEndOfSaleableLife = Boolean(req.body.isEndOfSaleableLife || req.body.endOfSaleableLifeTimestamp);
    if (existingEndpoint && isEndOfSaleableLife && req.body.forceReplace !== true) {
      return res.status(409).json({ message: 'An end-of-saleable-life endpoint already exists for this harvest; use forceReplace=true to correct it explicitly.' });
    }

    const endOfSaleableLifeTimestamp = req.body.endOfSaleableLifeTimestamp
      ? new Date(req.body.endOfSaleableLifeTimestamp)
      : (isEndOfSaleableLife ? observedAt : undefined);

    if (endOfSaleableLifeTimestamp && Number.isNaN(endOfSaleableLifeTimestamp.getTime())) {
      return res.status(400).json({ message: 'endOfSaleableLifeTimestamp must be a valid ISO-8601 timestamp' });
    }
    if (endOfSaleableLifeTimestamp && endOfSaleableLifeTimestamp.getTime() > Date.now()) {
      return res.status(400).json({ message: 'endOfSaleableLifeTimestamp cannot be in the future' });
    }
    if (endOfSaleableLifeTimestamp && harvestDate && endOfSaleableLifeTimestamp.getTime() < harvestDate.getTime()) {
      return res.status(400).json({ message: 'endOfSaleableLifeTimestamp cannot precede the harvest timestamp' });
    }

    const payload = {
      harvestId: harvest.id,
      farmerId: req.farmer.id,
      qualityGrade: req.body.qualityGrade,
      saleabilityStatus: req.body.saleabilityStatus,
      visibleSpoilage: req.body.visibleSpoilage,
      firmness: req.body.firmness,
      colorRipeness: req.body.colorRipeness,
      odorNote: req.body.odorNote,
      observerSource: req.body.observerSource || 'farmer',
      labelConfidence: req.body.labelConfidence || 'confirmed',
      observedAt,
      isEndOfSaleableLife,
      endOfSaleableLifeTimestamp: endOfSaleableLifeTimestamp || undefined,
      comments: req.body.comments,
    };

    const qualityObservation = await prisma.qualityObservation.create({ data: payload });
    res.status(201).json(toApiRecord(qualityObservation));
  } catch (err) {
    next(err);
  }
};

// GET /api/harvests/:id/quality-observations
const getQualityObservations = async (req, res, next) => {
  try {
    const harvest = await prisma.harvest.findFirst({ where: { id: req.params.id, farmerId: req.farmer.id } });
    if (!harvest) return res.status(404).json({ message: 'Harvest not found' });

    const observations = await prisma.qualityObservation.findMany({
      where: { harvestId: harvest.id },
      orderBy: { observedAt: 'desc' },
    });
    res.json(toApiRecords(observations));
  } catch (err) {
    next(err);
  }
};

// DELETE /api/harvests/:id
const deleteHarvest = async (req, res, next) => {
  try {
    const owned = await prisma.harvest.findFirst({ where: { id: req.params.id, farmerId: req.farmer.id } });
    const harvest = owned ? await prisma.harvest.delete({ where: { id: owned.id } }) : null;
    if (!harvest) return res.status(404).json({ message: 'Harvest not found' });
    res.json({ message: 'Harvest deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createHarvest,
  getHarvests,
  getHarvest,
  updateHarvest,
  submitQualityObservation,
  getQualityObservations,
  deleteHarvest,
};
