const PACKAGE_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export function sanitizeName(value, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

export function isValidPackageId(value) {
  return PACKAGE_ID_PATTERN.test(String(value || '').trim());
}
