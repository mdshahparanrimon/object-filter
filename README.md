# GHL Custom Object Test Microservice

Production-ready Express microservice for testing GoHighLevel custom object property workflows and associations.

## Stack

- Node.js 18+
- Express.js
- Axios
- dotenv
- Winston

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Update environment variables in `.env`.

3. Start server:

```bash
pnpm start
```

Service runs on `http://localhost:3000` by default.

## Environment Variables

```env
GHL_BASE_URL=https://services.leadconnectorhq.com
GHL_VERSION=2021-07-28
PORT=3000
```

## Required Request Headers

All `/api/*` endpoints require these headers:

- `x-ghl-api-token`: GHL API token (raw token or `Bearer <token>`)
- `x-location-id`: Location ID

If `x-ghl-api-token` is omitted, `Authorization` header is also accepted.

## Endpoints

### 1) Search property records

`POST /api/records-search`

Request body:

```json
{
  "address": "string"
}
```

Response:

```json
{
  "status": "match",
  "records": []
}
```

Status values:

- `match` means one or more records were found.
- `unmatch` means no records were found.

### 2) Create property record

`POST /api/create-record`

Request body:

```json
{
  "address": "string"
}
```

Response:

```json
{
  "status": "successful",
  "record": {}
}
```

### 3) Check association

`POST /api/check-association`

Request body:

```json
{
  "contactId": "string",
  "propertyId": "string"
}
```

Response:

```json
{
  "exists": true
}
```

### 4) Get associations

`GET /api/get-associations/:contactId`

Response:

```json
{
  "associations": []
}
```

### 5) Create association

`POST /api/create-association`

Request body:

```json
{
  "address": "string",
  "contactId": "string"
}
```

Response:

```json
{
  "status": "association_created",
  "propertyId": "string",
  "contactId": "string"
}
```

Status values:

- `association_created` means a new association was successfully created.
- `already_exists` means the contact is already associated with that property.
- `property_not_found` means no property was found for the given address.
- `association_create_failed` means association could not be verified after update.

## Address Normalization

Normalization logic:

- Lowercases text
- Removes punctuation
- Replaces words:
  - `avenue` -> `ave`
  - `street` -> `st`
  - `east` -> `e`
- Trims and collapses spaces

## cURL Examples

```bash
curl -X POST http://localhost:3000/api/records-search \
  -H "Content-Type: application/json" \
  -H "x-ghl-api-token: Bearer YOUR_TOKEN" \
  -H "x-location-id: abc123" \
  -d '{"address":"123 East Avenue"}'
```

```bash
curl -X POST http://localhost:3000/api/create-record \
  -H "Content-Type: application/json" \
  -H "x-ghl-api-token: Bearer YOUR_TOKEN" \
  -H "x-location-id: abc123" \
  -d '{"address":"123 East Avenue"}'
```

```bash
curl -X POST http://localhost:3000/api/check-association \
  -H "Content-Type: application/json" \
  -H "x-ghl-api-token: Bearer YOUR_TOKEN" \
  -H "x-location-id: abc123" \
  -d '{"contactId":"contact_1","propertyId":"property_1"}'
```

```bash
curl http://localhost:3000/api/get-associations/contact_1 \
  -H "x-ghl-api-token: Bearer YOUR_TOKEN" \
  -H "x-location-id: abc123"
```

```bash
curl -X POST http://localhost:3000/api/create-association \
  -H "Content-Type: application/json" \
  -H "x-ghl-api-token: Bearer YOUR_TOKEN" \
  -H "x-location-id: abc123" \
  -d '{"address":"123 East Avenue","contactId":"contact_1"}'
```