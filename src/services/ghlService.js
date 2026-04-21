const axios = require('axios');

const env = require('../config/env');
const logger = require('../config/logger');

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 300;
const CONTACT_PROPERTY_ASSOCIATION_KEY = 'property_owner_interested_contact';
const CONTACT_OBJECT_KEY = 'contact';
const PROPERTY_OBJECT_KEY = 'custom_objects.properties';

const ghlClient = axios.create({
  baseURL: env.ghl.baseUrl,
  timeout: 15000,
});

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetry(error) {
  if (!error.response) {
    return true;
  }

  const statusCode = error.response.status;
  return statusCode === 429 || statusCode >= 500;
}

function getUpstreamMessage(error, fallbackMessage) {
  if (!error || !error.response) {
    return error && error.message ? error.message : fallbackMessage;
  }

  const data = error.response.data;

  if (typeof data === 'string' && data.trim().length > 0) {
    return data;
  }

  if (data && typeof data.message === 'string') {
    return data.message;
  }

  if (data && typeof data.error === 'string') {
    return data.error;
  }

  return fallbackMessage;
}

function toServiceError(error, fallbackMessage) {
  const statusCode = error.response && error.response.status ? error.response.status : 500;

  const serviceError = new Error(getUpstreamMessage(error, fallbackMessage));
  serviceError.statusCode = statusCode;
  serviceError.code = 'GHL_API_ERROR';
  serviceError.details = {
    upstreamStatus: error.response ? error.response.status : null,
    upstreamBody: error.response ? error.response.data : null,
  };

  return serviceError;
}

async function requestWithRetry(requestConfig, meta, apiToken, options = {}) {
  const maxRetries =
    Number.isInteger(options.maxRetries) && options.maxRetries >= 0
      ? options.maxRetries
      : MAX_RETRIES;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const finalRequestConfig = {
        ...requestConfig,
        headers: {
          Authorization: apiToken,
          Version: env.ghl.version,
          'Content-Type': 'application/json',
          ...(requestConfig.headers || {}),
        },
      };

      return await ghlClient.request(finalRequestConfig);
    } catch (error) {
      const canRetry = shouldRetry(error);

      if (attempt >= maxRetries || !canRetry) {
        throw toServiceError(error, 'GHL request failed');
      }

      attempt += 1;
      const delayMs = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);

      logger.warn('Retrying GHL request', {
        endpoint: requestConfig.url,
        method: requestConfig.method,
        attempt,
        delayMs,
        upstreamStatus: error.response ? error.response.status : null,
        reason: error.message,
        meta,
      });

      await sleep(delayMs);
    }
  }

  throw new Error('GHL request failed unexpectedly');
}

function associationArrayFromResponse(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.associations)) {
    return data.associations;
  }

  if (data && data.data && Array.isArray(data.data.associations)) {
    return data.data.associations;
  }

  if (data && Array.isArray(data.data)) {
    return data.data;
  }

  return [];
}

function recordsArrayFromResponse(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.records)) {
    return data.records;
  }

  if (data && data.data && Array.isArray(data.data.records)) {
    return data.data.records;
  }

  if (data && Array.isArray(data.data)) {
    return data.data;
  }

  return [];
}

function associationsArrayFromResponse(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.associations)) {
    return data.associations;
  }

  if (data && data.data && Array.isArray(data.data.associations)) {
    return data.data.associations;
  }

  if (data && Array.isArray(data.data)) {
    return data.data;
  }

  return [];
}

function cleanAssociation(association) {
  const toObjectId =
    association.toObjectId || association.toId || association.relatedObjectId || null;

  return {
    id: association.id || association.associationId || null,
    toObjectId: toObjectId ? String(toObjectId) : null,
    toObjectType: association.toObjectType || association.toObjectKey || null,
    label: association.label || association.associationType || null,
  };
}

async function searchCustomObjectRecords({
  apiToken,
  locationId,
  page = 1,
  pageLimit = 20,
  filters = [],
}) {
  const response = await requestWithRetry(
    {
      method: 'post',
      url: '/objects/custom_objects.properties/records/search',
      data: {
        locationId,
        page,
        pageLimit,
        filters,
      },
    },
    { locationId, page, pageLimit },
    apiToken
  );

  return response.data;
}

async function searchRecords({ apiToken, locationId, address }) {
  const responseData = await searchCustomObjectRecords({
    apiToken,
    locationId,
    page: 1,
    pageLimit: 20,
    filters: [
      {
        field: 'properties.property_address',
        operator: 'eq',
        value: address,
      },
    ],
  });

  logger.info('GHL records search response', {
    endpoint: '/objects/custom_objects.properties/records/search',
    statusCode: 201,
    locationId,
  });

  return responseData;
}

async function createRecord({ apiToken, locationId, address }) {
  const response = await requestWithRetry(
    {
      method: 'post',
      url: '/objects/custom_objects.properties/records',
      data: {
        locationId,
        properties: {
          property_address: address,
        },
      },
    },
    { locationId },
    apiToken
  );

  logger.info('GHL create record response', {
    endpoint: '/objects/custom_objects.properties/records',
    statusCode: response.status,
    locationId,
  });

  return response.data;
}

async function getAssociations({ apiToken, locationId, contactId }) {
  const responseData = await searchCustomObjectRecords({
    apiToken,
    locationId,
    page: 1,
    pageLimit: 100,
    filters: [],
  });

  const records = recordsArrayFromResponse(responseData);
  const associations = [];

  records.forEach((record) => {
    const relations = Array.isArray(record.relations) ? record.relations : [];

    relations.forEach((relation) => {
      if (
        relation &&
        relation.objectKey === 'contact' &&
        String(relation.recordId) === String(contactId)
      ) {
        associations.push(
          cleanAssociation({
            associationId: relation.relationId || relation.associationId,
            toObjectId: record.id,
            toObjectType: record.objectKey,
            associationType: 'CUSTOM_OBJECT_RELATION',
          })
        );
      }
    });
  });

  logger.info('GHL get associations response', {
    endpoint: '/objects/custom_objects.properties/records/search',
    statusCode: 201,
    contactId,
    locationId,
    associationCount: associations.length,
  });

  return associations;
}

async function getRecordById({ apiToken, locationId, recordId }) {
  const responseData = await searchCustomObjectRecords({
    apiToken,
    locationId,
    page: 1,
    pageLimit: 1,
    filters: [
      {
        field: 'id',
        operator: 'eq',
        value: recordId,
      },
    ],
  });

  const records = recordsArrayFromResponse(responseData);
  return records.length > 0 ? records[0] : null;
}

async function getContactAssociationTypeId({ apiToken, locationId }) {
  const response = await requestWithRetry(
    {
      method: 'get',
      url: `/associations/objectKey/${encodeURIComponent(PROPERTY_OBJECT_KEY)}`,
      params: {
        locationId,
      },
    },
    { locationId },
    apiToken
  );

  const associations = associationsArrayFromResponse(response.data);
  const target = associations.find((association) => {
    const firstObjectKey = association.firstObjectKey;
    const secondObjectKey = association.secondObjectKey;

    return (
      association.key === CONTACT_PROPERTY_ASSOCIATION_KEY ||
      (firstObjectKey === CONTACT_OBJECT_KEY && secondObjectKey === PROPERTY_OBJECT_KEY) ||
      (firstObjectKey === PROPERTY_OBJECT_KEY && secondObjectKey === CONTACT_OBJECT_KEY)
    );
  });

  return target && typeof target.id === 'string' ? target.id : null;
}

async function createContactAssociationType({ apiToken, locationId }) {
  try {
    const response = await requestWithRetry(
      {
        method: 'post',
        url: '/associations/',
        params: {
          locationId,
        },
        data: {
          locationId,
          key: CONTACT_PROPERTY_ASSOCIATION_KEY,
          firstObjectKey: CONTACT_OBJECT_KEY,
          secondObjectKey: PROPERTY_OBJECT_KEY,
          firstObjectLabel: "Contact's Name",
          secondObjectLabel: 'Property Name',
        },
      },
      { locationId },
      apiToken
    );

    logger.info('GHL association type created', {
      endpoint: '/associations/',
      statusCode: response.status,
      locationId,
      key: CONTACT_PROPERTY_ASSOCIATION_KEY,
    });
  } catch (error) {
    const duplicateKeyError =
      error &&
      error.details &&
      error.details.upstreamBody &&
      typeof error.details.upstreamBody.message === 'string' &&
      error.details.upstreamBody.message.includes('Duplicate Association key');

    if (!duplicateKeyError) {
      throw error;
    }
  }
}

async function ensureContactAssociationTypeId({ apiToken, locationId }) {
  let associationId = await getContactAssociationTypeId({
    apiToken,
    locationId,
  });

  if (associationId) {
    return associationId;
  }

  await createContactAssociationType({
    apiToken,
    locationId,
  });

  associationId = await getContactAssociationTypeId({
    apiToken,
    locationId,
  });

  return associationId;
}

async function upsertAssociationByAddress({
  apiToken,
  locationId,
  address,
  contactId,
  associationId,
}) {
  const response = await requestWithRetry(
    {
      method: 'post',
      url: '/objects/custom_objects.properties/records/upsert',
      data: {
        locationId,
        properties: {
          property_address: address,
        },
        relations: [
          {
            associationId,
            recordId: contactId,
          },
        ],
      },
    },
    { locationId, contactId },
    apiToken
  );

  logger.info('GHL upsert association response', {
    endpoint: '/objects/custom_objects.properties/records/upsert',
    statusCode: response.status,
    locationId,
  });

  return response.data;
}

async function createRelation({
  apiToken,
  locationId,
  propertyRecordId,
  contactId,
  associationId,
}) {
  const endpoint = '/associations/relations/bulk';
  const requestPayload = {
    locationId,
    add: [
      {
        associationId,
        firstRecordId: contactId,
        secondRecordId: propertyRecordId,
      },
    ],
  };

  logger.info('GHL create relation request', {
    endpoint,
    locationId,
    payload: requestPayload,
  });

  try {
    const response = await requestWithRetry(
      {
        method: 'post',
        url: endpoint,
        data: requestPayload,
      },
      { locationId, propertyRecordId, contactId },
      apiToken,
      { maxRetries: 1 }
    );

    logger.info('GHL create relation response', {
      endpoint,
      statusCode: response.status,
      locationId,
      data: response.data,
    });

    const erroredRelations =
      response &&
      response.data &&
      response.data.results &&
      Array.isArray(response.data.results.errored)
        ? response.data.results.errored
        : [];

    if (erroredRelations.length > 0) {
      const firstError = erroredRelations[0];
      const relationError = new Error(
        (firstError && firstError.error) || 'Failed to create relation'
      );
      relationError.statusCode = 422;
      relationError.code = 'RELATION_CREATE_FAILED';
      relationError.details = {
        upstreamStatus: 422,
        upstreamBody: response.data,
      };
      throw relationError;
    }

    return response.data;
  } catch (error) {
    const mappedError = error && error.code === 'GHL_API_ERROR'
      ? error
      : toServiceError(error, 'Failed to create relation');

    logger.error('GHL create relation failed', {
      endpoint,
      locationId,
      propertyRecordId,
      contactId,
      message: mappedError.message,
      upstreamStatus: mappedError.details ? mappedError.details.upstreamStatus : null,
      upstreamBody: mappedError.details ? mappedError.details.upstreamBody : null,
    });

    const relationError = new Error(mappedError.message || 'Failed to create relation');
    relationError.statusCode = 500;
    relationError.code = 'RELATION_CREATE_FAILED';
    relationError.details = mappedError.details;
    throw relationError;
  }
}

module.exports = {
  searchRecords,
  createRecord,
  getAssociations,
  getRecordById,
  getContactAssociationTypeId,
  ensureContactAssociationTypeId,
  upsertAssociationByAddress,
  createRelation,
};