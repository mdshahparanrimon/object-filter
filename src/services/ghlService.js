const axios = require('axios');

const env = require('../config/env');
const logger = require('../config/logger');

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 300;

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

async function requestWithRetry(requestConfig, meta, apiToken) {
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
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

      if (attempt >= MAX_RETRIES || !canRetry) {
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
  const responseData = await searchCustomObjectRecords({
    apiToken,
    locationId,
    page: 1,
    pageLimit: 100,
    filters: [],
  });

  const records = recordsArrayFromResponse(responseData);

  for (const record of records) {
    const relations = Array.isArray(record.relations) ? record.relations : [];

    for (const relation of relations) {
      if (relation.objectKey === 'contact' && typeof relation.associationId === 'string') {
        return relation.associationId;
      }
    }
  }

  return null;
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

module.exports = {
  searchRecords,
  createRecord,
  getAssociations,
  getRecordById,
  getContactAssociationTypeId,
  upsertAssociationByAddress,
};