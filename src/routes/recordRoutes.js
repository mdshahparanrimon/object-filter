const express = require('express');

const {
  recordsSearchHandler,
  createRecordHandler,
  checkAssociationHandler,
  getAssociationsHandler,
} = require('../controllers/recordController');

const router = express.Router();

router.post('/records-search', recordsSearchHandler);
router.post('/create-record', createRecordHandler);
router.post('/check-association', checkAssociationHandler);
router.get('/get-associations/:contactId', getAssociationsHandler);

module.exports = router;