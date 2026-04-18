const LOCATION_QUERY_PATTERN = /^[\p{L}\p{M} .'-]+$/u;
const MIN_LOCATION_QUERY_LENGTH = 2;
const MAX_LOCATION_QUERY_LENGTH = 100;

export type LocationSearchValidationResult =
  | {
      valid: true;
      normalized: string;
    }
  | {
      valid: false;
      normalized: string;
    };

export function validateLocationSearchQuery(rawQuery: string): LocationSearchValidationResult {
  const normalized = rawQuery.trim();

  if (normalized.length < MIN_LOCATION_QUERY_LENGTH || normalized.length > MAX_LOCATION_QUERY_LENGTH) {
    return {
      valid: false,
      normalized,
    };
  }

  if (!LOCATION_QUERY_PATTERN.test(normalized)) {
    return {
      valid: false,
      normalized,
    };
  }

  return {
    valid: true,
    normalized,
  };
}
