import type { LogEntry } from "../types";

/**
 * Default sensitive field names that should be redacted.
 */
export const DEFAULT_SENSITIVE_FIELDS = [
  "password",
  "passwd",
  "pwd",
  "secret",
  "apiKey",
  "api_key",
  "apikey",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "authorization",
  "auth",
  "credentials",
  "private_key",
  "privateKey",
  "ssn",
  "socialSecurity",
  "social_security",
  "creditCard",
  "credit_card",
  "cardNumber",
  "card_number",
  "cvv",
  "cvc",
  "pin",
] as const;

/**
 * Default patterns to redact from log messages.
 * Note: Order matters! More specific patterns should come before general ones.
 */
export const DEFAULT_REDACTION_PATTERNS: Array<{
  pattern: RegExp;
  replacement: string;
}> = [
  // JWT tokens (must come before general token pattern)
  {
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    replacement: "[JWT]",
  },
  // Email addresses
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL]",
  },
  // Credit card numbers (various formats)
  {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: "[CARD]",
  },
  // Social Security Numbers
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: "[SSN]",
  },
  // API keys/tokens (common patterns)
  {
    pattern: /\b(sk|pk|api|key)[_-]?[a-zA-Z0-9]{20,}\b/gi,
    replacement: "[API_KEY]",
  },
  // Bearer tokens
  {
    pattern: /Bearer\s+[a-zA-Z0-9._-]+/gi,
    replacement: "Bearer [REDACTED]",
  },
  // Basic auth
  {
    pattern: /Basic\s+[a-zA-Z0-9+/=]+/gi,
    replacement: "Basic [REDACTED]",
  },
  // Password in key=value format (but not "Token: value" which is different)
  {
    pattern: /(password|passwd|pwd|secret)\s*[:=]\s*\S+/gi,
    replacement: "$1=[REDACTED]",
  },
  // AWS access keys
  {
    pattern: /\b(AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: "[AWS_KEY]",
  },
];

/**
 * Options for creating a redaction function.
 */
export interface RedactionOptions {
  /** Additional field names to redact (merged with defaults) */
  additionalFields?: string[];
  /** Additional patterns to redact (merged with defaults) */
  additionalPatterns?: Array<{ pattern: RegExp; replacement: string }>;
  /** Replace defaults entirely instead of merging */
  replaceDefaults?: boolean;
  /** Custom field names to redact (replaces defaults if replaceDefaults is true) */
  fields?: string[];
  /** Custom patterns to redact (replaces defaults if replaceDefaults is true) */
  patterns?: Array<{ pattern: RegExp; replacement: string }>;
  /** The replacement string for redacted fields. Default: "[REDACTED]" */
  fieldReplacement?: string;
}

/**
 * Create a redaction function with configurable options.
 *
 * @example
 * ```typescript
 * // Use defaults
 * const redact = createRedactor();
 *
 * // Add custom fields
 * const redact = createRedactor({
 *   additionalFields: ['internalId', 'sessionToken'],
 * });
 *
 * // Use in logger config
 * const log = createLogger({
 *   config: { redact: createRedactor() }
 * });
 * ```
 */
export const createRedactor = (
  options: RedactionOptions = {},
): ((entry: LogEntry) => LogEntry) => {
  const {
    additionalFields = [],
    additionalPatterns = [],
    replaceDefaults = false,
    fields = [],
    patterns = [],
    fieldReplacement = "[REDACTED]",
  } = options;

  const sensitiveFields = new Set<string>(
    replaceDefaults
      ? fields
      : [...DEFAULT_SENSITIVE_FIELDS, ...additionalFields],
  );

  const redactionPatterns = replaceDefaults
    ? patterns
    : [...DEFAULT_REDACTION_PATTERNS, ...additionalPatterns];

  const redactString = (str: string): string => {
    let result = str;
    for (const { pattern, replacement } of redactionPatterns) {
      // Create a new RegExp to reset lastIndex for global patterns
      const regex = new RegExp(pattern.source, pattern.flags);
      result = result.replace(regex, replacement);
    }
    return result;
  };

  const redactObject = (
    obj: Record<string, unknown>,
  ): Record<string, unknown> => {
    const result: Record<string, unknown> = { ...obj };
    for (const key of Object.keys(result)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.has(key) || sensitiveFields.has(lowerKey)) {
        result[key] = fieldReplacement;
      } else if (typeof result[key] === "string") {
        result[key] = redactString(result[key] as string);
      } else if (
        result[key] !== null &&
        typeof result[key] === "object" &&
        !Array.isArray(result[key])
      ) {
        result[key] = redactObject(result[key] as Record<string, unknown>);
      }
    }
    return result;
  };

  return (entry: LogEntry): LogEntry => {
    const redacted: LogEntry = {
      ...entry,
      message: redactString(entry.message),
    };

    if (entry.context) {
      redacted.context = redactObject(entry.context);
    }

    if (entry.metadata) {
      redacted.metadata = redactObject(entry.metadata);
    }

    return redacted;
  };
};

/**
 * Pre-configured redactor with default settings.
 * Convenience export for simple use cases.
 */
export const defaultRedactor = createRedactor();
