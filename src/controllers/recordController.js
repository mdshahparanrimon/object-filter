const {
  validateLocationAddressPayload,
  validateCheckAssociationPayload,
  validateContactIdParam,
} = require('../utils/validators');
const {
  searchRecords,
  createRecord,
  getAssociations,
} = require('../services/ghlService');

function recordsArrayFromSearchResult(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (result && Array.isArray(result.records)) {
    return result.records;
  }

  if (result && result.data && Array.isArray(result.data.records)) {
    return result.data.records;
  }

  if (result && Array.isArray(result.data)) {
    return result.data;
  }

  return [];
}

function createdRecordFromResult(result) {
  if (result && result.record) {
    return result.record;
  }

  if (result && result.data && result.data.record) {
    return result.data.record;
  }

  return result;
}

async function recordsSearchHandler(req, res, next) {
  try {
    const { isValid, errors } = validateLocationAddressPayload(req.body);

    if (!isValid) {
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }

    const { locationId, apiToken } = req.ghlContext;
    const address = req.body.address.trim();

    const searchResult = await searchRecords({
      apiToken,
      locationId,
      address,
    });

    const records = recordsArrayFromSearchResult(searchResult);
    const status = records.length > 0 ? 'match' : 'unmatch';

    return res.status(200).json({
      status,
      records,
    });
  } catch (error) {
    return next(error);
  }
}

async function createRecordHandler(req, res, next) {
  try {
    const { isValid, errors } = validateLocationAddressPayload(req.body);

    if (!isValid) {
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }

    const { locationId, apiToken } = req.ghlContext;
    const address = req.body.address.trim();

    const createdRecordResult = await createRecord({
      apiToken,
      locationId,
      address,
    });

    return res.status(201).json({
      status: 'successful',
      record: createdRecordFromResult(createdRecordResult),
    });
  } catch (error) {
    return next(error);
  }
}

async function checkAssociationHandler(req, res, next) {
  try {
    const { isValid, errors } = validateCheckAssociationPayload(req.body);

    if (!isValid) {
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }

    const associations = await getAssociations({
      apiToken: req.ghlContext.apiToken,
      contactId: req.body.contactId.trim(),
    });

    const propertyId = req.body.propertyId.trim();
    const exists = associations.some(
      (association) => association.toObjectId === String(propertyId)
    );

    return res.status(200).json({ exists });
  } catch (error) {
    return next(error);
  }
}

async function getAssociationsHandler(req, res, next) {
  try {
    const { isValid, errors } = validateContactIdParam(req.params);

    if (!isValid) {
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }

    const associations = await getAssociations({
      apiToken: req.ghlContext.apiToken,
      contactId: req.params.contactId.trim(),
    });

    return res.status(200).json({
      associations,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  recordsSearchHandler,
  createRecordHandler,
  checkAssociationHandler,
  getAssociationsHandler,
};