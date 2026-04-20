function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeApiToken(rawToken) {
  const trimmedToken = rawToken.trim();

  if (/^bearer\s+/i.test(trimmedToken)) {
    return trimmedToken;
  }

  return `Bearer ${trimmedToken}`;
}

function requiredHeaders(req, res, next) {
  const locationId = req.header('x-location-id');
  const tokenFromCustomHeader = req.header('x-ghl-api-token');
  const tokenFromAuthorizationHeader = req.header('authorization');
  const rawToken = tokenFromCustomHeader || tokenFromAuthorizationHeader;
  const errors = [];

  if (!isNonEmptyString(locationId)) {
    errors.push('x-location-id header is required');
  }

  if (!isNonEmptyString(rawToken)) {
    errors.push('x-ghl-api-token header is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors,
    });
  }

  req.ghlContext = {
    locationId: locationId.trim(),
    apiToken: normalizeApiToken(rawToken),
  };

  return next();
}

module.exports = requiredHeaders;