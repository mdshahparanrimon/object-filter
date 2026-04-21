const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const requiredEnvVars = [
  'GHL_BASE_URL',
  'GHL_VERSION',
];
const missingEnvVars = requiredEnvVars.filter((name) => {
  const value = process.env[name];
  return !value || value.trim().length === 0;
});

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

const parsedPort = Number.parseInt(process.env.PORT || '3000', 10);

if (Number.isNaN(parsedPort) || parsedPort <= 0) {
  throw new Error('PORT must be a valid positive number');
}

module.exports = {
  port: parsedPort,
  ghl: {
    baseUrl: process.env.GHL_BASE_URL,
    version: process.env.GHL_VERSION,
    propertyContactAssociationId: process.env.PROPERTY_CONTACT_ASSOCIATION_ID || '',
  },
};