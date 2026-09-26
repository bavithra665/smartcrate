const express = require('express');
const router = express.Router();
const { createHarvest, getHarvests, getHarvest, updateHarvest, deleteHarvest } = require('../controllers/harvestController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
	createHarvestValidators,
	updateHarvestValidators,
	harvestIdValidators,
	qualityObservationValidators,
} = require('../validators/requestValidators');
const { submitQualityObservation, getQualityObservations } = require('../controllers/harvestController');

router.use(protect);
router.post('/', createHarvestValidators, validate, createHarvest);
router.get('/', getHarvests);
router.post('/:id/quality-observations', harvestIdValidators, qualityObservationValidators, validate, submitQualityObservation);
router.get('/:id/quality-observations', harvestIdValidators, validate, getQualityObservations);
router.get('/:id', harvestIdValidators, validate, getHarvest);
router.put('/:id', updateHarvestValidators, validate, updateHarvest);
router.delete('/:id', harvestIdValidators, validate, deleteHarvest);

module.exports = router;
