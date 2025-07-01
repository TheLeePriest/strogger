import { describe, expect, it, vi } from "vitest";
import {
  ConfigurationError,
  ERROR_MESSAGES,
  LoggerError,
  TransportError,
  ValidationError,
  createDetailedError,
  handleTransportError,
  validateEnvironmentVariable,
  validateTransportConfig,
} from "../../src/utils/errors";

describe("Error Classes", () => {
  describe("LoggerError", () => {
    it("should create a LoggerError with message and code", () => {
      const error = new LoggerError("Test error", "TEST_ERROR");

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_ERROR");
      expect(error.details).toBeUndefined();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(LoggerError);
    });

    it("should create a LoggerError with details", () => {
      const details = { field: "test", value: "invalid" };
      const error = new LoggerError("Test error", "TEST_ERROR", details);

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_ERROR");
      expect(error.details).toEqual(details);
    });
  });

  describe("TransportError", () => {
    it("should create a TransportError with transport name", () => {
      const error = new TransportError("Transport failed", "newrelic");

      expect(error.message).toBe("Transport failed");
      expect(error.code).toBe("TRANSPORT_ERROR");
      expect(error.transportName).toBe("newrelic");
      expect(error).toBeInstanceOf(LoggerError);
      expect(error).toBeInstanceOf(TransportError);
    });

    it("should create a TransportError with details", () => {
      const details = { statusCode: 500, response: "Server error" };
      const error = new TransportError("Transport failed", "newrelic", details);

      expect(error.message).toBe("Transport failed");
      expect(error.transportName).toBe("newrelic");
      expect(error.details).toEqual({ ...details, transportName: "newrelic" });
    });
  });

  describe("ConfigurationError", () => {
    it("should create a ConfigurationError", () => {
      const error = new ConfigurationError("Invalid config");

      expect(error.message).toBe("Invalid config");
      expect(error.code).toBe("CONFIGURATION_ERROR");
      expect(error).toBeInstanceOf(LoggerError);
      expect(error).toBeInstanceOf(ConfigurationError);
    });
  });

  describe("ValidationError", () => {
    it("should create a ValidationError", () => {
      const error = new ValidationError("Validation failed");

      expect(error.message).toBe("Validation failed");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error).toBeInstanceOf(LoggerError);
      expect(error).toBeInstanceOf(ValidationError);
    });
  });
});

describe("ERROR_MESSAGES", () => {
  it("should contain all expected error messages", () => {
    expect(ERROR_MESSAGES).toHaveProperty("NEW_RELIC_MISSING_API_KEY");
    expect(ERROR_MESSAGES).toHaveProperty("NEW_RELIC_MISSING_ACCOUNT_ID");
    expect(ERROR_MESSAGES).toHaveProperty("NEW_RELIC_API_ERROR");
    expect(ERROR_MESSAGES).toHaveProperty("FORMATTER_MISSING");
    expect(ERROR_MESSAGES).toHaveProperty("TRANSPORT_SEND_FAILED");
    expect(ERROR_MESSAGES).toHaveProperty("MISSING_SERVICE_NAME");
  });

  it("should have proper structure for each error message", () => {
    for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
      expect(message).toHaveProperty("message");
      expect(message).toHaveProperty("solution");
      expect(typeof message.message).toBe("string");
      expect(typeof message.solution).toBe("string");
      // Some messages may not have examples
      if ("example" in message) {
        expect(typeof message.example).toBe("string");
      }
    }
  });
});

describe("createDetailedError", () => {
  it("should create a TransportError for transport-related errors", () => {
    const error = createDetailedError("NEW_RELIC_MISSING_API_KEY", "newrelic");

    expect(error).toBeInstanceOf(TransportError);
    if (error instanceof TransportError) {
      expect(error.transportName).toBe("newrelic");
    }
    expect(error.message).toContain("New Relic");
    expect(error.details).toHaveProperty("solution");
    expect(error.details).toHaveProperty("example");
  });

  it("should create a LoggerError for non-transport errors", () => {
    const error = createDetailedError("FORMATTER_MISSING");

    expect(error).toBeInstanceOf(LoggerError);
    expect(error).not.toBeInstanceOf(TransportError);
    expect(error.message).toContain("formatter");
    expect(error.details).toHaveProperty("solution");
    expect(error.details).toHaveProperty("example");
  });

  it("should include additional details when provided", () => {
    const additionalDetails = { customField: "customValue" };
    const error = createDetailedError(
      "NEW_RELIC_MISSING_API_KEY",
      "newrelic",
      additionalDetails,
    );

    expect(error.details).toHaveProperty("customField", "customValue");
  });
});

describe("validateEnvironmentVariable", () => {
  it("should not throw for valid required environment variable", () => {
    expect(() => {
      validateEnvironmentVariable("API_KEY", "valid-key", true);
    }).not.toThrow();
  });

  it("should throw ConfigurationError for missing required environment variable", () => {
    expect(() => {
      validateEnvironmentVariable("API_KEY", undefined, true);
    }).toThrow(ConfigurationError);
  });

  it("should not throw for missing optional environment variable", () => {
    expect(() => {
      validateEnvironmentVariable("OPTIONAL_KEY", undefined, false);
    }).not.toThrow();
  });

  it("should not throw for present optional environment variable", () => {
    expect(() => {
      validateEnvironmentVariable("OPTIONAL_KEY", "present", false);
    }).not.toThrow();
  });
});

describe("validateTransportConfig", () => {
  it("should not throw for valid transport config", () => {
    const config = { apiKey: "key", accountId: "id" };
    const requiredFields = ["apiKey", "accountId"];

    expect(() => {
      validateTransportConfig("newrelic", config, requiredFields);
    }).not.toThrow();
  });

  it("should throw TransportError for missing required fields", () => {
    const config = { apiKey: "key" };
    const requiredFields = ["apiKey", "accountId"];

    expect(() => {
      validateTransportConfig("newrelic", config, requiredFields);
    }).toThrow(TransportError);
  });

  it("should include transport name in error message", () => {
    const config = {};
    const requiredFields = ["apiKey"];

    try {
      validateTransportConfig("newrelic", config, requiredFields);
    } catch (error) {
      expect(error).toBeInstanceOf(TransportError);
      if (error instanceof TransportError) {
        expect(error.transportName).toBe("newrelic");
      }
      expect(error.message).toContain("apiKey");
    }
  });
});

describe("handleTransportError", () => {
  it("should log error to console when fallbackToConsole is true", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Test error");

    handleTransportError(error, "newrelic", true);

    expect(consoleSpy).toHaveBeenCalledWith(
      "[LOGGER ERROR] Unexpected error in newrelic: Test error",
    );

    consoleSpy.mockRestore();
  });

  it("should not log error to console when fallbackToConsole is false", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Test error");

    expect(() => {
      handleTransportError(error, "newrelic", false);
    }).toThrow(TransportError);

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("should handle non-Error objects", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = "String error";

    handleTransportError(error, "newrelic", true);

    expect(consoleSpy).toHaveBeenCalledWith(
      "[LOGGER ERROR] Unknown error in newrelic",
    );

    consoleSpy.mockRestore();
  });
});
