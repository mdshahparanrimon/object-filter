function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildMissingFields(body, fields) {
  return fields.filter((field) => !isNonEmptyString(body[field]));
}

function validateLocationAddressPayload(body) {
  const missingFields = buildMissingFields(body || {}, ['address']);

  return {
    isValid: missingFields.length === 0,
    errors: missingFields.map((field) => `${field} is required`),
  };
}

function validateCheckAssociationPayload(body) {
  const missingFields = buildMissingFields(body || {}, ['contactId', 'propertyId']);

  return {
    isValid: missingFields.length === 0,
    errors: missingFields.map((field) => `${field} is required`),
  };
}

function validateContactIdParam(params) {
  const hasContactId = isNonEmptyString(params && params.contactId);

  return {
    isValid: hasContactId,
    errors: hasContactId ? [] : ['contactId param is required'],
  };
}

module.exports = {
  validateLocationAddressPayload,
  validateCheckAssociationPayload,
  validateContactIdParam,
};