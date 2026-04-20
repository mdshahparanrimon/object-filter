const {
  validateLocationAddressPayload,
  validateCheckAssociationPayload,
  validateCreateAssociationPayload,
  validateContactIdParam,
} = require('../utils/validators');
const {
  searchRecords,
  createRecord,
  getAssociations,
  ensureContactAssociationTypeId,
  upsertAssociationByAddress,
} = require('../services/ghlService');

function getRequestBody(reqBody) {
  if (reqBody && typeof reqBody === 'object') {
    return reqBody;
  }

  if (typeof reqBody !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(reqBody);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
}

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
    const payload = getRequestBody(req.body);
    const { isValid, errors } = validateLocationAddressPayload(payload);

    if (!isValid) {
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }

    const { locationId, apiToken } = req.ghlContext;
    const address = payload.address.trim();

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
    const payload = getRequestBody(req.body);
    const { isValid, errors } = validateLocationAddressPayload(payload);

    if (!isValid) {
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }

    const { locationId, apiToken } = req.ghlContext;
    const address = payload.address.trim();

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
    const payload = getRequestBody(req.body);
    const { isValid, errors } = validateCheckAssociationPayload(payload);

    if (!isValid) {
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }

    const associations = await getAssociations({
      apiToken: req.ghlContext.apiToken,
      locationId: req.ghlContext.locationId,
      contactId: payload.contactId.trim(),
    });

    const propertyId = payload.propertyId.trim();
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
      locationId: req.ghlContext.locationId,
      contactId: req.params.contactId.trim(),
    });

    return res.status(200).json({
      associations,
    });
  } catch (error) {
    return next(error);
  }
}

async function createAssociationHandler(req, res, next) {
  try {
    const payload = getRequestBody(req.body);
    const { isValid, errors } = validateCreateAssociationPayload(payload);

    if (!isValid) {
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }

    const { locationId, apiToken } = req.ghlContext;
    const address = payload.address.trim();
    const contactId = payload.contactId.trim();

    const searchResult = await searchRecords({
      apiToken,
      locationId,
      address,
    });

    const records = recordsArrayFromSearchResult(searchResult);
    const propertyRecord = records.length > 0 ? records[0] : null;

    if (!propertyRecord) {
      return res.status(200).json({
        status: 'property_not_found',
        address,
        contactId,
      });
    }

    const associationId = await ensureContactAssociationTypeId({
      apiToken,
      locationId,
    });

    if (!associationId) {
      return res.status(422).json({
        message: 'Unable to determine contact association type id',
        code: 'ASSOCIATION_TYPE_NOT_FOUND',
      });
    }

    const upsertResult = await upsertAssociationByAddress({
      apiToken,
      locationId,
      address,
      contactId,
      associationId,
    });

    return res.status(200).json({
      status: 'association_submitted',
      propertyId: propertyRecord.id,
      contactId,
      traceId: upsertResult && upsertResult.traceId ? upsertResult.traceId : null,
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
  createAssociationHandler,
};