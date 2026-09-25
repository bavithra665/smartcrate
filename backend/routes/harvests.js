const express = require('express');
const router = express.Router();
const { createHarvest, getHarvests, getHarvest, updateHarvest, deleteHarvest } = require('../controllers/harvestController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
	createHarvestValidators,
	updateHarvestValidators,
	harvestIdValidators,
} = require('../validators/requestValidators');

router.use(protect);
router.post('/', createHarvestValidators, validate, createHarvest);
router.get('/', getHarvests);
router.get('/:id', harvestIdValidators, validate, getHarvest);
router.put('/:id', updateHarvestValidators, validate, updateHarvest);
router.delete('/:id', harvestIdValidators, validate, deleteHarvest);

module.exports = router;
