import { beforeEach, describe, expect, it } from "vitest";
import { getEnvironment } from "../../src/utils/environment";

describe("getEnvironment", () => {
  beforeEach(() => {
    // Reset environment variables
    process.env.LOG_LEVEL = undefined;
    process.env.STAGE = undefined;
    process.env.SERVICE_NAME = undefined;
    process.env.ENABLE_STRUCTURED_LOGGING = undefined;
    process.env.CLOUDWATCH_LOG_GROUP = undefined;
    process.env.CLOUDWATCH_LOG_STREAM = undefined;
    process.env.AWS_REGION = undefined;
  });

  it("should return default values when no environment variables are set", () => {
    const env = getEnvironment();

    expect(env.STAGE).toBe("dev");
    expect(env.isProduction).toBe(false);
    expect(env.isDevelopment).toBe(true);
    expect(env.logLevel).toBeUndefined();
    expect(env.serviceName).toBeUndefined();
    expect(env.enableStructuredLogging).toBe(true);
    expect(env.stage).toBe("dev");
  });

  it("should parse valid environment variables correctly", () => {
    process.env.LOG_LEVEL = "INFO";
    process.env.STAGE = "prod";
    process.env.SERVICE_NAME = "test-service";
    process.env.ENABLE_STRUCTURED_LOGGING = "false";
    process.env.CLOUDWATCH_LOG_GROUP = "/aws/lambda/test";
    process.env.CLOUDWATCH_LOG_STREAM = "test-stream";
    process.env.AWS_REGION = "us-east-1";

    const env = getEnvironment();

    expect(env.LOG_LEVEL).toBe("INFO");
    expect(env.STAGE).toBe("prod");
    expect(env.SERVICE_NAME).toBe("test-service");
    expect(env.enableStructuredLogging).toBe(false);
    expect(env.CLOUDWATCH_LOG_GROUP).toBe("/aws/lambda/test");
    expect(env.CLOUDWATCH_LOG_STREAM).toBe("test-stream");
    expect(env.AWS_REGION).toBe("us-east-1");
    expect(env.isProduction).toBe(true);
    expect(env.isDevelopment).toBe(false);
  });

  it("should handle invalid LOG_LEVEL gracefully", () => {
    process.env.LOG_LEVEL = "INVALID_LEVEL";

    const env = getEnvironment();

    expect(env.LOG_LEVEL).toBeUndefined();
    expect(env.STAGE).toBe("dev"); // Should still have default
  });

  it("should handle invalid STAGE gracefully", () => {
    process.env.STAGE = "invalid-stage";

    const env = getEnvironment();

    expect(env.STAGE).toBe("dev"); // Should fall back to default
    expect(env.isProduction).toBe(false);
    expect(env.isDevelopment).toBe(true);
  });

  it("should accept custom environment object", () => {
    const customEnv = {
      LOG_LEVEL: "DEBUG",
      STAGE: "test",
      SERVICE_NAME: "custom-service",
    };

    const env = getEnvironment(customEnv);

    expect(env.LOG_LEVEL).toBe("DEBUG");
    expect(env.STAGE).toBe("test");
    expect(env.SERVICE_NAME).toBe("custom-service");
    expect(env.isProduction).toBe(false);
    expect(env.isDevelopment).toBe(false);
  });

  it("should handle all valid log levels", () => {
    const validLevels = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"];

    for (const level of validLevels) {
      process.env.LOG_LEVEL = level;
      const env = getEnvironment();
      expect(env.LOG_LEVEL).toBe(level);
    }
  });

  it("should handle all valid stages", () => {
    const validStages = ["dev", "prod", "test"];

    for (const stage of validStages) {
      process.env.STAGE = stage;
      const env = getEnvironment();
      expect(env.STAGE).toBe(stage);
    }
  });

  it("should correctly set boolean flags based on stage", () => {
    // Test dev stage
    process.env.STAGE = "dev";
    let env = getEnvironment();
    expect(env.isDevelopment).toBe(true);
    expect(env.isProduction).toBe(false);

    // Test prod stage
    process.env.STAGE = "prod";
    env = getEnvironment();
    expect(env.isDevelopment).toBe(false);
    expect(env.isProduction).toBe(true);

    // Test test stage
    process.env.STAGE = "test";
    env = getEnvironment();
    expect(env.isDevelopment).toBe(false);
    expect(env.isProduction).toBe(false);
  });

  it("should handle ENABLE_STRUCTURED_LOGGING boolean conversion", () => {
    process.env.ENABLE_STRUCTURED_LOGGING = "true";
    let env = getEnvironment();
    expect(env.enableStructuredLogging).toBe(true);

    process.env.ENABLE_STRUCTURED_LOGGING = "false";
    env = getEnvironment();
    expect(env.enableStructuredLogging).toBe(false);

    process.env.ENABLE_STRUCTURED_LOGGING = undefined;
    env = getEnvironment();
    expect(env.enableStructuredLogging).toBe(true); // Default value
  });
});
