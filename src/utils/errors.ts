// Custom error classes for the logger
export class LoggerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "LoggerError";
  }
}

export class TransportError extends LoggerError {
  constructor(
    message: string,
    public readonly transportName: string,
    details?: Record<string, unknown>,
  ) {
    super(message, "TRANSPORT_ERROR", { transportName, ...details });
    this.name = "TransportError";
  }
}

export class ConfigurationError extends LoggerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFIGURATION_ERROR", details);
    this.name = "ConfigurationError";
  }
}

export class ValidationError extends LoggerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

// Error message templates
export const ERROR_MESSAGES = {
  // New Relic specific errors
  NEW_RELIC_MISSING_API_KEY: {
    message:
      "New Relic transport requires NEW_RELIC_LICENSE_KEY environment variable",
    solution:
      "Set NEW_RELIC_LICENSE_KEY in your environment variables or pass apiKey option",
    example: "NEW_RELIC_LICENSE_KEY=your-license-key-here",
  },
  NEW_RELIC_MISSING_ACCOUNT_ID: {
    message:
      "New Relic transport requires NEW_RELIC_ACCOUNT_ID environment variable",
    solution:
      "Set NEW_RELIC_ACCOUNT_ID in your environment variables or pass accountId option",
    example: "NEW_RELIC_ACCOUNT_ID=your-account-id-here",
  },
  NEW_RELIC_API_ERROR: {
    message: "Failed to send logs to New Relic API",
    solution: "Check your API key, account ID, and network connectivity",
  },

  // DataDog specific errors
  DATADOG_MISSING_API_KEY: {
    message: "DataDog transport requires DATADOG_API_KEY environment variable",
    solution: "Set DATADOG_API_KEY in your environment variables",
    example: "DATADOG_API_KEY=your-api-key-here",
  },
  DATADOG_API_ERROR: {
    message: "Failed to send logs to DataDog API",
    solution: "Check your API key and network connectivity",
  },

  // CloudWatch specific errors
  CLOUDWATCH_MISSING_CREDENTIALS: {
    message: "CloudWatch transport requires AWS credentials",
    solution:
      "Configure AWS credentials via environment variables, IAM role, or AWS credentials file",
    example: "AWS_ACCESS_KEY_ID=your-key\nAWS_SECRET_ACCESS_KEY=your-secret",
  },
  CLOUDWATCH_MISSING_LOG_GROUP: {
    message: "CloudWatch transport requires logGroupName option",
    solution:
      "Provide logGroupName in transport options or set CLOUDWATCH_LOG_GROUP environment variable",
    example: 'logGroupName: "/aws/lambda/my-function"',
  },
  CLOUDWATCH_LOG_GROUP_NOT_FOUND: {
    message: "CloudWatch log group does not exist",
    solution: "Create the log group in CloudWatch before using this transport",
    example:
      'aws logs create-log-group --log-group-name "/aws/lambda/my-function"',
  },
  CLOUDWATCH_API_ERROR: {
    message: "Failed to send logs to CloudWatch",
    solution: "Check your AWS credentials, region, and network connectivity",
  },
  CLOUDWATCH_SDK_NOT_FOUND: {
    message: "AWS SDK for CloudWatch Logs not installed",
    solution: "Install the AWS SDK: npm install @aws-sdk/client-cloudwatch-logs",
    example: "npm install @aws-sdk/client-cloudwatch-logs",
  },

  // General transport errors
  TRANSPORT_INITIALIZATION_FAILED: {
    message: "Failed to initialize transport",
    solution: "Check transport configuration and required dependencies",
  },
  TRANSPORT_SEND_FAILED: {
    message: "Failed to send log entry to transport",
    solution: "Check transport configuration and network connectivity",
  },

  // Configuration errors
  MISSING_SERVICE_NAME: {
    message: "Logger configuration requires serviceName",
    solution:
      "Set SERVICE_NAME environment variable or provide serviceName in config",
    example: "SERVICE_NAME=my-service",
  },
  INVALID_LOG_LEVEL: {
    message: "Invalid log level specified",
    solution: "Use one of: DEBUG, INFO, WARN, ERROR, FATAL",
    example: "LOG_LEVEL=INFO",
  },

  // Environment errors
  ENVIRONMENT_VALIDATION_FAILED: {
    message: "Environment configuration validation failed",
    solution: "Check your environment variables and configuration",
  },

  // Formatter errors
  FORMATTER_MISSING: {
    message: "Logger requires a formatter",
    solution: "Provide a formatter object with a format(entry) method",
    example: "formatter: createJsonFormatter()",
  },

  // Performance monitor errors
  PERFORMANCE_MONITOR_INITIALIZATION_FAILED: {
    message: "Failed to initialize performance monitor",
    solution: "Check performance monitor configuration",
  },

  // Splunk specific errors
  SPLUNK_MISSING_HEC_URL: {
    message: "Splunk transport requires SPLUNK_HEC_URL environment variable",
    solution: "Set SPLUNK_HEC_URL in your environment variables",
    example:
      "SPLUNK_HEC_URL=https://your-splunk-instance:8088/services/collector",
  },
  SPLUNK_MISSING_HEC_TOKEN: {
    message: "Splunk transport requires SPLUNK_HEC_TOKEN environment variable",
    solution: "Set SPLUNK_HEC_TOKEN in your environment variables",
    example: "SPLUNK_HEC_TOKEN=your-hec-token-here",
  },
  SPLUNK_API_ERROR: {
    message: "Failed to send logs to Splunk HEC",
    solution: "Check your HEC URL, token, and network connectivity",
  },

  // Elasticsearch specific errors
  ELASTICSEARCH_MISSING_AUTH: {
    message: "Elasticsearch transport requires authentication",
    solution: "Set ELASTICSEARCH_API_KEY or ELASTICSEARCH_USERNAME/PASSWORD",
    example: "ELASTICSEARCH_API_KEY=your-api-key-here",
  },
  ELASTICSEARCH_MISSING_DATE: {
    message: "Date string is missing for Elasticsearch index pattern",
    solution:
      "Check date generation logic and ensure valid date string is produced",
  },
  ELASTICSEARCH_API_ERROR: {
    message: "Failed to send logs to Elasticsearch",
    solution:
      "Check your connection URL, authentication, and network connectivity",
  },
  ELASTICSEARCH_PARTIAL_ERROR: {
    message: "Some documents failed to index in Elasticsearch",
    solution: "Check document structure and index mappings",
  },
} as const;

// Helper function to create detailed error messages
export const createDetailedError = (
  errorKey: keyof typeof ERROR_MESSAGES,
  transportName?: string,
  additionalDetails?: Record<string, unknown>,
): TransportError | LoggerError => {
  const errorInfo = ERROR_MESSAGES[errorKey];
  const message = `${errorInfo.message}${transportName ? ` (${transportName})` : ""}`;

  const details = {
    ...errorInfo,
    ...additionalDetails,
    ...(transportName && { transportName }),
  };

  if (transportName) {
    return new TransportError(message, transportName, details);
  }

  return new LoggerError(message, "LOGGER_ERROR", details);
};

// Helper function to validate environment variables
export const validateEnvironmentVariable = (
  name: string,
  value: string | undefined,
  required = false,
): void => {
  if (required && !value) {
    throw new ConfigurationError(
      `Required environment variable ${name} is not set`,
      {
        missingVariable: name,
        message: `Required environment variable ${name} is not set`,
      },
    );
  }
};

// Helper function to validate transport configuration
export const validateTransportConfig = (
  transportName: string,
  config: Record<string, unknown>,
  requiredFields: string[],
): void => {
  const missingFields = requiredFields.filter((field) => !config[field]);

  if (missingFields.length > 0) {
    throw new TransportError(
      `Missing required configuration fields: ${missingFields.join(", ")}`,
      transportName,
      {
        missingFields,
        message: `Missing required configuration fields: ${missingFields.join(", ")}`,
      },
    );
  }
};

// Helper function to handle transport errors gracefully
export const handleTransportError = (
  error: unknown,
  transportName: string,
  fallbackToConsole = true,
): void => {
  let loggerError: LoggerError;

  if (error instanceof LoggerError) {
    loggerError = error;
  } else if (error instanceof Error) {
    loggerError = new TransportError(
      `Unexpected error in ${transportName}: ${error.message}`,
      transportName,
      { originalError: error.message, stack: error.stack },
    );
  } else {
    loggerError = new TransportError(
      `Unknown error in ${transportName}`,
      transportName,
      { originalError: error },
    );
  }

  if (fallbackToConsole) {
    console.error(`[LOGGER ERROR] ${loggerError.message}`);
    if (loggerError.details?.solution) {
      console.error(`[LOGGER SOLUTION] ${loggerError.details.solution}`);
    }
    if (loggerError.details?.example) {
      console.error(`[LOGGER EXAMPLE] ${loggerError.details.example}`);
    }
  }

  // Re-throw if not falling back to console
  if (!fallbackToConsole) {
    throw loggerError;
  }
};
