# Error Handling Guide

The `@cdk-insights/logger` library provides comprehensive error handling with clear, actionable error messages, detailed solutions, and examples. This guide covers all aspects of error handling in the logger.

## 📋 Table of Contents

1. [Error Classes](#error-classes)
2. [Error Messages](#error-messages)
3. [Transport Error Handling](#transport-error-handling)
4. [Configuration Error Handling](#configuration-error-handling)
5. [Environment Error Handling](#environment-error-handling)
6. [Validation Error Handling](#validation-error-handling)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## 🚨 Error Classes

The logger provides several specialized error classes for different types of errors:

### **LoggerError**
Base error class for all logger-related errors.

```typescript
import { LoggerError } from '@cdk-insights/logger';

try {
  // Some logger operation
} catch (error) {
  if (error instanceof LoggerError) {
    console.error(`Logger error: ${error.message}`);
    console.error(`Error code: ${error.code}`);
    console.error(`Details:`, error.details);
  }
}
```

### **TransportError**
Errors specific to transport operations (API failures, network issues, etc.).

```typescript
import { TransportError } from '@cdk-insights/logger';

try {
  const dataDogTransport = createDataDogTransport({
    apiKey: 'invalid-key'
  });
} catch (error) {
  if (error instanceof TransportError) {
    console.error(`Transport ${error.transportName} failed:`, error.message);
    console.error('Solution:', error.details?.solution);
    console.error('Example:', error.details?.example);
  }
}
```

### **ConfigurationError**
Errors related to logger configuration issues.

```typescript
import { ConfigurationError } from '@cdk-insights/logger';

try {
  const logger = createLogger({
    config: { /* invalid config */ }
  });
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error('Configuration error:', error.message);
    console.error('Details:', error.details);
  }
}
```

### **ValidationError**
Errors related to data validation failures.

```typescript
import { ValidationError } from '@cdk-insights/logger';

try {
  // Some validation operation
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error.message);
    console.error('Details:', error.details);
  }
}
```

## 📝 Error Messages

The logger provides detailed error messages with solutions and examples:

### **New Relic Errors**

```typescript
// NEW_RELIC_MISSING_API_KEY
{
  message: "New Relic transport requires NEW_RELIC_LICENSE_KEY environment variable",
  solution: "Set NEW_RELIC_LICENSE_KEY in your environment variables or pass apiKey option",
  example: "NEW_RELIC_LICENSE_KEY=your-license-key-here"
}

// NEW_RELIC_MISSING_ACCOUNT_ID
{
  message: "New Relic transport requires NEW_RELIC_ACCOUNT_ID environment variable",
  solution: "Set NEW_RELIC_ACCOUNT_ID in your environment variables or pass accountId option",
  example: "NEW_RELIC_ACCOUNT_ID=your-account-id-here"
}

// NEW_RELIC_API_ERROR
{
  message: "Failed to send logs to New Relic API",
  solution: "Check your API key, account ID, and network connectivity"
}
```

### **DataDog Errors**

```typescript
// DATADOG_MISSING_API_KEY
{
  message: "DataDog transport requires DATADOG_API_KEY environment variable",
  solution: "Set DATADOG_API_KEY in your environment variables",
  example: "DATADOG_API_KEY=your-api-key-here"
}

// DATADOG_API_ERROR
{
  message: "Failed to send logs to DataDog API",
  solution: "Check your API key and network connectivity"
}
```

### **Splunk Errors**

```typescript
// SPLUNK_MISSING_HEC_URL
{
  message: "Splunk transport requires SPLUNK_HEC_URL environment variable",
  solution: "Set SPLUNK_HEC_URL in your environment variables",
  example: "SPLUNK_HEC_URL=https://your-splunk-instance:8088/services/collector"
}

// SPLUNK_MISSING_HEC_TOKEN
{
  message: "Splunk transport requires SPLUNK_HEC_TOKEN environment variable",
  solution: "Set SPLUNK_HEC_TOKEN in your environment variables",
  example: "SPLUNK_HEC_TOKEN=your-hec-token-here"
}

// SPLUNK_API_ERROR
{
  message: "Failed to send logs to Splunk HEC",
  solution: "Check your HEC URL, token, and network connectivity"
}
```

### **Elasticsearch Errors**

```typescript
// ELASTICSEARCH_MISSING_AUTH
{
  message: "Elasticsearch transport requires authentication",
  solution: "Set ELASTICSEARCH_API_KEY or ELASTICSEARCH_USERNAME/PASSWORD",
  example: "ELASTICSEARCH_API_KEY=your-api-key-here"
}

// ELASTICSEARCH_API_ERROR
{
  message: "Failed to send logs to Elasticsearch",
  solution: "Check your connection URL, authentication, and network connectivity"
}
```

### **General Errors**

```typescript
// TRANSPORT_INITIALIZATION_FAILED
{
  message: "Failed to initialize transport",
  solution: "Check transport configuration and required dependencies"
}

// TRANSPORT_SEND_FAILED
{
  message: "Failed to send log entry to transport",
  solution: "Check transport configuration and network connectivity"
}

// MISSING_SERVICE_NAME
{
  message: "Logger configuration requires serviceName",
  solution: "Set SERVICE_NAME environment variable or provide serviceName in config",
  example: "SERVICE_NAME=my-service"
}

// INVALID_LOG_LEVEL
{
  message: "Invalid log level specified",
  solution: "Use one of: DEBUG, INFO, WARN, ERROR, FATAL",
  example: "LOG_LEVEL=INFO"
}
```

## 🚚 Transport Error Handling

Transport errors are automatically handled with graceful fallbacks and detailed error reporting.

### **Automatic Error Handling**

```typescript
import { 
  createDataDogTransport, 
  handleTransportError 
} from '@cdk-insights/logger';

const dataDogTransport = createDataDogTransport({
  apiKey: process.env.DATADOG_API_KEY,
  // Transport automatically handles errors and provides fallbacks
});

// Manual error handling
try {
  await dataDogTransport.flush();
} catch (error) {
  handleTransportError(error, 'DataDog', true);
  // This will log the error to console and provide solutions
}
```

### **Custom Error Handling**

```typescript
import { 
  TransportError, 
  ERROR_MESSAGES,
  createDetailedError 
} from '@cdk-insights/logger';

const customTransport = {
  log: async (entry) => {
    try {
      await sendToCustomService(entry);
    } catch (error) {
      // Create detailed error with context
      const transportError = createDetailedError(
        'TRANSPORT_SEND_FAILED',
        'CustomTransport',
        {
          originalError: error.message,
          entry: {
            level: entry.level,
            message: entry.message,
            timestamp: entry.timestamp,
          },
        }
      );
      
      // Handle the error
      handleTransportError(transportError, 'CustomTransport', true);
    }
  },
  setLevel: (level) => { /* implementation */ },
  getLevel: () => LogLevel.INFO,
};
```

### **Transport Health Checks**

```typescript
const checkTransportHealth = async (transport) => {
  try {
    // Test the transport
    await transport.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message: 'Health check',
    });
    return true;
  } catch (error) {
    console.error('Transport health check failed:', error);
    return false;
  }
};

// Usage
const isHealthy = await checkTransportHealth(dataDogTransport);
if (!isHealthy) {
  console.warn('DataDog transport is unhealthy, falling back to console');
}
```

## ⚙️ Configuration Error Handling

Configuration errors are caught early and provide clear guidance on how to fix them.

### **Environment Variable Validation**

```typescript
import { 
  validateEnvironmentVariable,
  ConfigurationError 
} from '@cdk-insights/logger';

const validateConfig = () => {
  try {
    // Validate required environment variables
    validateEnvironmentVariable('DATADOG_API_KEY', process.env.DATADOG_API_KEY, true);
    validateEnvironmentVariable('SERVICE_NAME', process.env.SERVICE_NAME, true);
    
    // Validate optional variables with defaults
    validateEnvironmentVariable('LOG_LEVEL', process.env.LOG_LEVEL, false);
    
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error('Configuration validation failed:', error.message);
      console.error('Details:', error.details);
      process.exit(1);
    }
  }
};
```

### **Transport Configuration Validation**

```typescript
import { 
  validateTransportConfig,
  TransportError 
} from '@cdk-insights/logger';

const validateDataDogConfig = (config) => {
  try {
    validateTransportConfig('DataDog', config, ['apiKey', 'serviceName']);
  } catch (error) {
    if (error instanceof TransportError) {
      console.error('DataDog configuration error:', error.message);
      console.error('Missing fields:', error.details?.missingFields);
      throw error;
    }
  }
};

// Usage
validateDataDogConfig({
  apiKey: process.env.DATADOG_API_KEY,
  serviceName: process.env.SERVICE_NAME,
});
```

## 🌍 Environment Error Handling

Environment-related errors are handled gracefully with fallbacks to default values.

### **Environment Validation**

```typescript
import { getEnvironment } from '@cdk-insights/logger';

const env = getEnvironment();

// The getEnvironment function automatically handles validation errors
// and provides sensible defaults
console.log('Environment:', {
  stage: env.stage,
  isProduction: env.isProduction,
  isDevelopment: env.isDevelopment,
  logLevel: env.logLevel,
  serviceName: env.serviceName,
});
```

### **Custom Environment Handling**

```typescript
import { 
  LoggerEnvironmentSchema,
  ConfigurationError 
} from '@cdk-insights/logger';

const getCustomEnvironment = (envVars = process.env) => {
  try {
    return LoggerEnvironmentSchema.parse(envVars);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn('Environment validation failed, using defaults:', error.errors);
      return { STAGE: 'dev' };
    }
    throw new ConfigurationError('Failed to parse environment', { originalError: error });
  }
};
```

## ✅ Validation Error Handling

Validation errors ensure data quality and prevent malformed logs.

### **Log Entry Validation**

```typescript
import { ValidationError } from '@cdk-insights/logger';

const validateLogEntry = (entry) => {
  try {
    // Validate required fields
    if (!entry.message || entry.message.trim().length === 0) {
      throw new ValidationError('Log message cannot be empty');
    }
    
    if (entry.level < 0 || entry.level > 4) {
      throw new ValidationError('Invalid log level');
    }
    
    // Validate message length
    if (entry.message.length > 1000) {
      throw new ValidationError('Log message too long (max 1000 characters)');
    }
    
    // Validate context structure
    if (entry.context && typeof entry.context !== 'object') {
      throw new ValidationError('Context must be an object');
    }
    
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Log validation failed:', error.message);
      console.error('Entry:', entry);
      throw error;
    }
  }
};
```

### **Schema Validation**

```typescript
import { z } from 'zod';
import { ValidationError } from '@cdk-insights/logger';

const LogEntrySchema = z.object({
  message: z.string().min(1).max(1000),
  level: z.number().min(0).max(4),
  timestamp: z.string().datetime(),
  context: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const validateWithSchema = (entry) => {
  try {
    LogEntrySchema.parse(entry);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(`Schema validation failed: ${error.message}`, {
        errors: error.errors,
        entry,
      });
    }
  }
};
```

## 🛡️ Error Recovery Strategies

The logger provides several strategies for error recovery and graceful degradation.

### **Fallback Transports**

```typescript
import { 
  createConsoleTransport,
  createDataDogTransport,
  handleTransportError 
} from '@cdk-insights/logger';

const createFallbackTransport = (primaryTransport, fallbackTransport) => {
  return {
    log: async (entry) => {
      try {
        await primaryTransport.log(entry);
      } catch (error) {
        console.warn('Primary transport failed, using fallback:', error.message);
        try {
          await fallbackTransport.log(entry);
        } catch (fallbackError) {
          handleTransportError(fallbackError, 'FallbackTransport', true);
        }
      }
    },
    setLevel: (level) => {
      primaryTransport.setLevel(level);
      fallbackTransport.setLevel(level);
    },
    getLevel: () => primaryTransport.getLevel(),
  };
};

// Usage
const dataDogTransport = createDataDogTransport({ /* config */ });
const consoleTransport = createConsoleTransport();
const fallbackTransport = createFallbackTransport(dataDogTransport, consoleTransport);
```

### **Retry Logic**

```typescript
const createRetryTransport = (transport, maxRetries = 3, delay = 1000) => {
  return {
    log: async (entry) => {
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await transport.log(entry);
          return; // Success
        } catch (error) {
          lastError = error;
          
          if (attempt < maxRetries) {
            console.warn(`Transport attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          }
        }
      }
      
      // All retries failed
      handleTransportError(lastError, transport.constructor.name, true);
    },
    setLevel: (level) => transport.setLevel(level),
    getLevel: () => transport.getLevel(),
  };
};
```

### **Circuit Breaker Pattern**

```typescript
class CircuitBreaker {
  constructor(failureThreshold = 5, timeout = 60000) {
    this.failureThreshold = failureThreshold;
    this.timeout = timeout;
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

const createCircuitBreakerTransport = (transport) => {
  const circuitBreaker = new CircuitBreaker();
  
  return {
    log: async (entry) => {
      await circuitBreaker.execute(() => transport.log(entry));
    },
    setLevel: (level) => transport.setLevel(level),
    getLevel: () => transport.getLevel(),
  };
};
```

## 🎯 Best Practices

### **Error Handling Strategy**

1. **Fail Fast**: Validate configuration early and fail with clear error messages
2. **Graceful Degradation**: Provide fallbacks when transports fail
3. **Detailed Logging**: Log errors with context and solutions
4. **Retry Logic**: Implement retries with exponential backoff
5. **Circuit Breakers**: Prevent cascading failures
6. **Monitoring**: Monitor error rates and transport health

### **Configuration Validation**

```typescript
const validateLoggerConfig = (config) => {
  const errors = [];
  
  // Validate required fields
  if (!config.serviceName) {
    errors.push('serviceName is required');
  }
  
  // Validate log level
  if (config.level !== undefined && (config.level < 0 || config.level > 4)) {
    errors.push('level must be between 0 and 4');
  }
  
  // Validate sampling rate
  if (config.samplingRate !== undefined && (config.samplingRate < 0 || config.samplingRate > 1)) {
    errors.push('samplingRate must be between 0 and 1');
  }
  
  // Validate rate limiting
  if (config.rateLimit) {
    if (!config.rateLimit.maxLogsPerSecond || config.rateLimit.maxLogsPerSecond <= 0) {
      errors.push('rateLimit.maxLogsPerSecond must be positive');
    }
    if (!config.rateLimit.burstSize || config.rateLimit.burstSize <= 0) {
      errors.push('rateLimit.burstSize must be positive');
    }
  }
  
  if (errors.length > 0) {
    throw new ConfigurationError('Invalid logger configuration', { errors });
  }
};
```

### **Error Monitoring**

```typescript
const createErrorMonitoringHook = () => {
  return (entry) => {
    if (entry.error) {
      // Track error metrics
      metricsService.increment('logger.errors', {
        level: entry.level,
        errorType: entry.error.name,
        service: entry.context?.serviceName,
      });
      
      // Send critical errors to alerting system
      if (entry.level === LogLevel.FATAL) {
        alertService.sendAlert({
          severity: 'critical',
          message: `Logger fatal error: ${entry.message}`,
          error: entry.error.message,
          stack: entry.error.stack,
        });
      }
    }
  };
};
```

## 🔧 Troubleshooting

### **Common Issues and Solutions**

#### **Transport Connection Failures**

```typescript
// Problem: DataDog transport failing to connect
// Solution: Check API key and network connectivity

const diagnoseDataDogConnection = async () => {
  try {
    const response = await fetch('https://http-intake.logs.datadoghq.com/api/v2/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': process.env.DATADOG_API_KEY,
      },
      body: JSON.stringify([{ message: 'test' }]),
    });
    
    if (!response.ok) {
      console.error('DataDog connection test failed:', response.status, response.statusText);
    } else {
      console.log('DataDog connection test successful');
    }
  } catch (error) {
    console.error('DataDog connection test error:', error.message);
  }
};
```

#### **Configuration Issues**

```typescript
// Problem: Logger not working as expected
// Solution: Validate configuration step by step

const diagnoseLoggerConfig = () => {
  console.log('Environment variables:');
  console.log('- DATADOG_API_KEY:', process.env.DATADOG_API_KEY ? 'SET' : 'NOT SET');
  console.log('- SERVICE_NAME:', process.env.SERVICE_NAME || 'NOT SET');
  console.log('- LOG_LEVEL:', process.env.LOG_LEVEL || 'NOT SET');
  console.log('- STAGE:', process.env.STAGE || 'NOT SET');
  
  console.log('\nEnvironment validation:');
  try {
    const env = getEnvironment();
    console.log('✓ Environment validation passed');
    console.log('Environment:', env);
  } catch (error) {
    console.error('✗ Environment validation failed:', error.message);
  }
};
```

#### **Performance Issues**

```typescript
// Problem: Logger causing performance issues
// Solution: Check rate limiting and sampling

const diagnosePerformance = (logger) => {
  console.log('Performance diagnostics:');
  console.log('- Sampling rate:', logger.config.samplingRate);
  console.log('- Rate limit:', logger.config.rateLimit);
  console.log('- Batching enabled:', logger.config.batching);
  
  // Check transport statistics
  logger.transports.forEach((transport, index) => {
    if (transport.getStats) {
      const stats = transport.getStats();
      console.log(`- Transport ${index} stats:`, stats);
    }
  });
};
```

### **Debug Mode**

Enable debug mode to see detailed error information:

```typescript
const createDebugLogger = () => {
  return createLogger({
    config: {
      level: LogLevel.DEBUG,
      hooks: [
        (entry) => {
          console.log(`[DEBUG] Processing log: ${entry.level} - ${entry.message}`);
          if (entry.error) {
            console.log(`[DEBUG] Error:`, entry.error);
          }
        },
      ],
    },
    transports: [createConsoleTransport({ level: LogLevel.DEBUG })],
    formatter: createJsonFormatter(),
    env: getEnvironment(),
  });
};
```

## 📚 Additional Resources

- [Advanced Features Guide](./advanced-features.md) - Learn about filtering, validation, and redaction
- [Third-Party Integrations](./third-party-integrations.md) - Transport-specific error handling
- [Performance Monitoring](./advanced-features.md#performance-monitoring) - Monitor logger performance
- [Error Handling Examples](./../src/examples/error-handling-example.ts) - Complete error handling examples 