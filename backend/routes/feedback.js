const express = require('express');
const router = express.Router();
const { submitFeedback, getMyFeedback } = require('../controllers/feedbackController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { feedbackValidators } = require('../validators/requestValidators');

router.use(protect);
router.post('/', feedbackValidators, validate, submitFeedback);
router.get('/', getMyFeedback);

module.exports = router;
