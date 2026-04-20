const express = require('express');

const recordRoutes = require('./recordRoutes');

const router = express.Router();

router.use(recordRoutes);

module.exports = router;