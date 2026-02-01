import { describe, expect, it } from "vitest";
import {
  createRedactor,
  defaultRedactor,
  DEFAULT_SENSITIVE_FIELDS,
  DEFAULT_REDACTION_PATTERNS,
} from "../../src/utils/redaction";
import { LogEntry, LogLevel } from "../../src/types";

const createTestEntry = (
  message: string,
  context?: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): LogEntry => ({
  timestamp: new Date().toISOString(),
  level: LogLevel.INFO,
  message,
  context,
  metadata,
});

describe("redaction utilities", () => {
  describe("DEFAULT_SENSITIVE_FIELDS", () => {
    it("should include common sensitive field names", () => {
      expect(DEFAULT_SENSITIVE_FIELDS).toContain("password");
      expect(DEFAULT_SENSITIVE_FIELDS).toContain("apiKey");
      expect(DEFAULT_SENSITIVE_FIELDS).toContain("secret");
      expect(DEFAULT_SENSITIVE_FIELDS).toContain("token");
      expect(DEFAULT_SENSITIVE_FIELDS).toContain("creditCard");
      expect(DEFAULT_SENSITIVE_FIELDS).toContain("ssn");
    });
  });

  describe("DEFAULT_REDACTION_PATTERNS", () => {
    it("should be an array of pattern objects", () => {
      expect(Array.isArray(DEFAULT_REDACTION_PATTERNS)).toBe(true);
      expect(DEFAULT_REDACTION_PATTERNS.length).toBeGreaterThan(0);
      DEFAULT_REDACTION_PATTERNS.forEach((p) => {
        expect(p.pattern).toBeInstanceOf(RegExp);
        expect(typeof p.replacement).toBe("string");
      });
    });
  });

  describe("createRedactor", () => {
    it("should create a function", () => {
      const redact = createRedactor();
      expect(typeof redact).toBe("function");
    });

    describe("message redaction", () => {
      it("should redact email addresses", () => {
        const redact = createRedactor();
        const entry = createTestEntry("Contact user@example.com for help");
        const result = redact(entry);
        expect(result.message).toBe("Contact [EMAIL] for help");
      });

      it("should redact credit card numbers", () => {
        const redact = createRedactor();
        const entry = createTestEntry("Card: 4111-1111-1111-1111");
        const result = redact(entry);
        expect(result.message).toBe("Card: [CARD]");
      });

      it("should redact SSN", () => {
        const redact = createRedactor();
        const entry = createTestEntry("SSN is 123-45-6789");
        const result = redact(entry);
        expect(result.message).toBe("SSN is [SSN]");
      });

      it("should redact password in key=value format", () => {
        const redact = createRedactor();
        const entry = createTestEntry("Config: password=supersecret123");
        const result = redact(entry);
        expect(result.message).toBe("Config: password=[REDACTED]");
      });

      it("should redact Bearer tokens", () => {
        const redact = createRedactor();
        const entry = createTestEntry("Auth: Bearer eyJhbGciOiJIUzI1NiJ9.test");
        const result = redact(entry);
        expect(result.message).toBe("Auth: Bearer [REDACTED]");
      });

      it("should redact Basic auth", () => {
        const redact = createRedactor();
        const entry = createTestEntry("Auth: Basic dXNlcjpwYXNz");
        const result = redact(entry);
        expect(result.message).toBe("Auth: Basic [REDACTED]");
      });

      it("should redact JWT tokens", () => {
        const redact = createRedactor();
        const entry = createTestEntry(
          "Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature",
        );
        const result = redact(entry);
        expect(result.message).toBe("Token: [JWT]");
      });

      it("should redact AWS access keys", () => {
        const redact = createRedactor();
        const entry = createTestEntry("AWS Key: AKIAIOSFODNN7EXAMPLE");
        const result = redact(entry);
        expect(result.message).toBe("AWS Key: [AWS_KEY]");
      });

      it("should handle multiple patterns in same message", () => {
        const redact = createRedactor();
        const entry = createTestEntry(
          "User user@example.com with card 4111-1111-1111-1111",
        );
        const result = redact(entry);
        expect(result.message).toBe("User [EMAIL] with card [CARD]");
      });
    });

    describe("context redaction", () => {
      it("should redact sensitive field values", () => {
        const redact = createRedactor();
        const entry = createTestEntry("Login attempt", {
          password: "secret123",
          username: "john",
        });
        const result = redact(entry);
        expect(result.context?.password).toBe("[REDACTED]");
        expect(result.context?.username).toBe("john");
      });

      it("should redact case-insensitively", () => {
        const redact = createRedactor();
        const entry = createTestEntry("Login", {
          PASSWORD: "secret123",
          ApiKey: "key123",
        });
        const result = redact(entry);
        expect(result.context?.PASSWORD).toBe("[REDACTED]");
        expect(result.context?.ApiKey).toBe("[REDACTED]");
      });

      it("should redact patterns in string values", () => {
        const redact = createRedactor();
        const entry = createTestEntry("User info", {
          email: "user@example.com",
          note: "Contact user@example.com",
        });
        const result = redact(entry);
        expect(result.context?.email).toBe("[EMAIL]");
        expect(result.context?.note).toBe("Contact [EMAIL]");
      });

      it("should handle nested objects", () => {
        const redact = createRedactor();
        const entry = createTestEntry("Nested", {
          user: {
            password: "secret",
            name: "John",
          },
        });
        const result = redact(entry);
        expect((result.context?.user as Record<string, unknown>)?.password).toBe(
          "[REDACTED]",
        );
        expect((result.context?.user as Record<string, unknown>)?.name).toBe(
          "John",
        );
      });
    });

    describe("metadata redaction", () => {
      it("should redact sensitive fields in metadata", () => {
        const redact = createRedactor();
        const entry = createTestEntry(
          "Action",
          {},
          {
            apiKey: "key123",
            action: "login",
          },
        );
        const result = redact(entry);
        expect(result.metadata?.apiKey).toBe("[REDACTED]");
        expect(result.metadata?.action).toBe("login");
      });
    });

    describe("custom options", () => {
      it("should allow additional fields", () => {
        const redact = createRedactor({
          additionalFields: ["internalId"],
        });
        const entry = createTestEntry("User", {
          internalId: "secret-id",
          userId: "user-123",
        });
        const result = redact(entry);
        expect(result.context?.internalId).toBe("[REDACTED]");
        expect(result.context?.userId).toBe("user-123");
      });

      it("should allow additional patterns", () => {
        const redact = createRedactor({
          additionalPatterns: [
            { pattern: /CUSTOM-\d{4}/g, replacement: "[CUSTOM_ID]" },
          ],
        });
        const entry = createTestEntry("ID: CUSTOM-1234");
        const result = redact(entry);
        expect(result.message).toBe("ID: [CUSTOM_ID]");
      });

      it("should allow replacing defaults", () => {
        const redact = createRedactor({
          replaceDefaults: true,
          fields: ["customSecret"],
          patterns: [],
        });

        // Default field should not be redacted
        const entry1 = createTestEntry("Test", { password: "secret" });
        const result1 = redact(entry1);
        expect(result1.context?.password).toBe("secret");

        // Custom field should be redacted
        const entry2 = createTestEntry("Test", { customSecret: "secret" });
        const result2 = redact(entry2);
        expect(result2.context?.customSecret).toBe("[REDACTED]");
      });

      it("should allow custom replacement string", () => {
        const redact = createRedactor({
          fieldReplacement: "***HIDDEN***",
        });
        const entry = createTestEntry("Login", { password: "secret" });
        const result = redact(entry);
        expect(result.context?.password).toBe("***HIDDEN***");
      });
    });
  });

  describe("defaultRedactor", () => {
    it("should be a pre-configured redactor", () => {
      expect(typeof defaultRedactor).toBe("function");
    });

    it("should redact with default settings", () => {
      const entry = createTestEntry("Login", {
        password: "secret",
        email: "user@example.com",
      });
      const result = defaultRedactor(entry);
      expect(result.context?.password).toBe("[REDACTED]");
    });
  });
});
