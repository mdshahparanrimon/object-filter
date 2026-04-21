const express = require('express');

const recordRoutes = require('./recordRoutes');
const propertyRoutes = require('./property');

const router = express.Router();

router.use(recordRoutes);
router.use(propertyRoutes);

module.exports = router;