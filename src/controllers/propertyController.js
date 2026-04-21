const env = require('../config/env');
const { validateLinkPropertyContactPayload } = require('../utils/validators');
const { createRelation } = require('../services/ghlService');

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

async function linkPropertyContactHandler(req, res, next) {
  try {
    const payload = getRequestBody(req.body);
    const { isValid, errors } = validateLinkPropertyContactPayload(payload);
    const associationId = (env.ghl.propertyContactAssociationId || '').trim();

    if (!isValid) {
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }

    if (!associationId) {
      return res.status(500).json({
        message: 'Missing PROPERTY_CONTACT_ASSOCIATION_ID configuration',
        code: 'CONFIGURATION_ERROR',
      });
    }

    const { locationId, apiToken } = req.ghlContext;
    const data = await createRelation({
      apiToken,
      locationId,
      propertyRecordId: payload.propertyRecordId.trim(),
      contactId: payload.contactId.trim(),
      associationId,
    });

    return res.status(200).json({
      success: true,
      message: 'Relation created successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  linkPropertyContactHandler,
};