const express = require('express');

const {
  linkPropertyContactHandler,
} = require('../controllers/propertyController');

const router = express.Router();

router.post('/link-property-contact', linkPropertyContactHandler);

module.exports = router;