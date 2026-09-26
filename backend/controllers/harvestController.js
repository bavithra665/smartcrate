const Harvest = require('../models/Harvest');
const QualityObservation = require('../models/QualityObservation');

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

    const harvest = await Harvest.create({
      farmerId: req.farmer._id,
      crop, variety, quantity, unit, initialWeight,
      harvestDate, harvestTime, maturityStage,
      storageType, storageCondition,
      farmerLocation: farmerLocation || req.farmer.location,
      notes,
    });

    res.status(201).json(harvest);
  } catch (err) {
    next(err);
  }
};

// GET /api/harvests  (farmer's own harvests)
const getHarvests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { farmerId: req.farmer._id };
    if (status) filter.status = status;
    const harvests = await Harvest.find(filter).sort({ createdAt: -1 });
    res.json(harvests);
  } catch (err) {
    next(err);
  }
};

// GET /api/harvests/:id
const getHarvest = async (req, res, next) => {
  try {
    const harvest = await Harvest.findOne({ _id: req.params.id, farmerId: req.farmer._id });
    if (!harvest) return res.status(404).json({ message: 'Harvest not found' });
    res.json(harvest);
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

    const harvest = await Harvest.findOneAndUpdate(
      { _id: req.params.id, farmerId: req.farmer._id },
      updates,
      { new: true, runValidators: true }
    );
    if (!harvest) return res.status(404).json({ message: 'Harvest not found' });
    res.json(harvest);
  } catch (err) {
    next(err);
  }
};

// POST /api/harvests/:id/quality-observations
const submitQualityObservation = async (req, res, next) => {
  try {
    const harvest = await Harvest.findOne({ _id: req.params.id, farmerId: req.farmer._id });
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

    const existingByTimestamp = await QualityObservation.findOne({
      harvestId: harvest._id,
      observedAt,
    });
    if (existingByTimestamp) {
      return res.status(409).json({ message: 'A quality observation already exists for this timestamp' });
    }

    const existingEndpointQuery = QualityObservation.findOne({
      harvestId: harvest._id,
      isEndOfSaleableLife: true,
    });
    const existingEndpoint = typeof existingEndpointQuery?.sort === 'function'
      ? await existingEndpointQuery.sort({ observedAt: -1 })
      : await existingEndpointQuery;

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
      harvestId: harvest._id,
      farmerId: req.farmer._id,
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

    const qualityObservation = await QualityObservation.create(payload);
    res.status(201).json(qualityObservation);
  } catch (err) {
    next(err);
  }
};

// GET /api/harvests/:id/quality-observations
const getQualityObservations = async (req, res, next) => {
  try {
    const harvest = await Harvest.findOne({ _id: req.params.id, farmerId: req.farmer._id });
    if (!harvest) return res.status(404).json({ message: 'Harvest not found' });

    const observations = await QualityObservation.find({ harvestId: harvest._id }).sort({ observedAt: -1 });
    res.json(observations);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/harvests/:id
const deleteHarvest = async (req, res, next) => {
  try {
    const harvest = await Harvest.findOneAndDelete({ _id: req.params.id, farmerId: req.farmer._id });
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
