const Harvest = require('../models/Harvest');

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

module.exports = { createHarvest, getHarvests, getHarvest, updateHarvest, deleteHarvest };
