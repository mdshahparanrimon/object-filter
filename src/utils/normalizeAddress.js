const replacements = [
  { pattern: /\bavenue\b/g, value: 'ave' },
  { pattern: /\bstreet\b/g, value: 'st' },
  { pattern: /\beast\b/g, value: 'e' },
];

function normalizeAddress(address) {
  if (typeof address !== 'string') {
    return '';
  }

  let normalized = address.toLowerCase();
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');

  replacements.forEach(({ pattern, value }) => {
    normalized = normalized.replace(pattern, value);
  });

  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

module.exports = normalizeAddress;