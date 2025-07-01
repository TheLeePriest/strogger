# Advanced Features Guide

This guide covers the advanced features available in the `@cdk-insights/logger` library, including log filtering, validation, redaction, hooks, sampling, rate limiting, enrichment, batching, and security features.

## 📋 Table of Contents

1. [Log Filtering](#log-filtering)
2. [Log Validation](#log-validation)
3. [Log Redaction/Encryption](#log-redactionencryption)
4. [Custom Hooks](#custom-hooks)
5. [Log Sampling](#log-sampling)
6. [Rate Limiting](#rate-limiting)
7. [Log Enrichment](#log-enrichment)
8. [Log Batching](#log-batching)
9. [Forbidden Keys Filtering/Redaction](#forbidden-keys-filteringredaction)
10. [Production Configuration](#production-configuration)
11. [Performance Monitoring](#performance-monitoring)
12. [Correlation Tracking](#correlation-tracking)

## 🔍 Log Filtering

Log filtering allows you to control which log entries are processed and sent to transports. This is useful for reducing noise, focusing on specific events, or implementing conditional logging.

### Basic Filtering

```typescript
import { createLogger, LogLevel, getEnvironment } from '@cdk-insights/logger';

const env = getEnvironment();

const logger = createLogger({
  config: {
    serviceName: 'filtered-service',
    filter: (entry) => {
      // Only log errors and warnings
      if (entry.level >= LogLevel.WARN) return true;
      
      // Only log requests for admin users
      if (entry.context?.userId === 'admin') return true;
      
      // Skip debug logs in production
      if (entry.level === LogLevel.DEBUG && env.isProduction) {
        return false;
      }
      
      return true;
    },
  },
  transports: [createConsoleTransport()],
  formatter: createJsonFormatter(),
  env,
});
```

### Advanced Filtering Examples

```typescript
// Filter by message content
const messageFilter = (entry) => {
  // Skip health check logs
  if (entry.message.includes('health check')) return false;
  
  // Skip noisy debug messages
  if (entry.message.includes('cache hit') && entry.level === LogLevel.DEBUG) {
    return false;
  }
  
  return true;
};

// Filter by context
const contextFilter = (entry) => {
  // Only log requests with specific user roles
  const allowedRoles = ['admin', 'support', 'manager'];
  if (entry.context?.userRole && !allowedRoles.includes(entry.context.userRole)) {
    return false;
  }
  
  // Skip logs from test users
  if (entry.context?.userId?.startsWith('test-')) {
    return false;
  }
  
  return true;
};

// Filter by performance metrics
const performanceFilter = (entry) => {
  // Only log slow operations
  if (entry.context?.duration && entry.context.duration < 1000) {
    return false;
  }
  
  return true;
};

// Combine multiple filters
const combinedFilter = (entry) => {
  return messageFilter(entry) && contextFilter(entry) && performanceFilter(entry);
};
```

## ✅ Log Validation

Log validation ensures that log entries meet your quality standards before they are processed. This helps prevent malformed logs and enforces consistency.

### Basic Validation

```typescript
const logger = createLogger({
  config: {
    serviceName: 'validated-service',
    validate: (entry) => {
      // Ensure message is not empty
      if (!entry.message || entry.message.trim().length === 0) {
        throw new Error('Log message cannot be empty');
      }
      
      // Validate log level
      if (entry.level < 0 || entry.level > 4) {
        throw new Error('Invalid log level');
      }
      
      // Ensure required context fields
      if (!entry.context?.requestId) {
        throw new Error('Request ID is required');
      }
    },
  },
  transports: [createConsoleTransport()],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

### Security Validation

```typescript
const securityValidator = (entry) => {
  // Check for sensitive data in messages
  const sensitivePatterns = [
    /password\s*[:=]\s*\S+/i,
    /api[_-]?key\s*[:=]\s*\S+/i,
    /secret\s*[:=]\s*\S+/i,
    /token\s*[:=]\s*\S+/i,
  ];
  
  for (const pattern of sensitivePatterns) {
    if (pattern.test(entry.message)) {
      throw new Error('Sensitive data detected in log message');
    }
  }
  
  // Validate message length
  if (entry.message.length > 1000) {
    throw new Error('Log message too long (max 1000 characters)');
  }
};
```

### Schema Validation

```typescript
import { z } from 'zod';

const LogEntrySchema = z.object({
  message: z.string().min(1).max(1000),
  level: z.number().min(0).max(4),
  context: z.object({
    requestId: z.string().optional(),
    userId: z.string().optional(),
  }).optional(),
});

const schemaValidator = (entry) => {
  try {
    LogEntrySchema.parse(entry);
  } catch (error) {
    throw new Error(`Schema validation failed: ${error.message}`);
  }
};
```

## 🔐 Log Redaction/Encryption

Log redaction automatically removes or masks sensitive information from log entries before they are sent to transports.

### Basic Redaction

```typescript
const logger = createLogger({
  config: {
    serviceName: 'redacted-service',
    redact: (entry) => {
      const redacted = { ...entry };
      
      // Mask email addresses
      if (redacted.message) {
        redacted.message = redacted.message.replace(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
          '[EMAIL]'
        );
      }
      
      // Mask credit card numbers
      if (redacted.message) {
        redacted.message = redacted.message.replace(
          /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
          '[CARD_NUMBER]'
        );
      }
      
      // Remove sensitive context fields
      if (redacted.context) {
        const { password, apiKey, secret, token, ...safeContext } = redacted.context;
        redacted.context = safeContext;
      }
      
      return redacted;
    },
  },
  transports: [createConsoleTransport()],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

### Advanced Redaction

```typescript
const advancedRedactor = (entry) => {
  const redacted = { ...entry };
  
  // Redact sensitive patterns in message
  const patterns = [
    { regex: /password\s*[:=]\s*\S+/gi, replacement: 'password=[REDACTED]' },
    { regex: /api[_-]?key\s*[:=]\s*\S+/gi, replacement: 'api_key=[REDACTED]' },
    { regex: /secret\s*[:=]\s*\S+/gi, replacement: 'secret=[REDACTED]' },
    { regex: /token\s*[:=]\s*\S+/gi, replacement: 'token=[REDACTED]' },
    { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' }, // Social Security Numbers
    { regex: /\b\d{10,11}\b/g, replacement: '[PHONE]' }, // Phone numbers
  ];
  
  if (redacted.message) {
    patterns.forEach(({ regex, replacement }) => {
      redacted.message = redacted.message.replace(regex, replacement);
    });
  }
  
  // Redact sensitive fields in context and metadata
  const sensitiveFields = ['password', 'apiKey', 'secret', 'token', 'ssn', 'phone'];
  
  if (redacted.context) {
    sensitiveFields.forEach(field => {
      if (redacted.context[field]) {
        redacted.context[field] = '[REDACTED]';
      }
    });
  }
  
  if (redacted.metadata) {
    sensitiveFields.forEach(field => {
      if (redacted.metadata[field]) {
        redacted.metadata[field] = '[REDACTED]';
      }
    });
  }
  
  return redacted;
};
```

## 🪝 Custom Hooks

Custom hooks allow you to execute custom logic when logs are processed, such as metrics collection, alerting, or analytics.

### Basic Hooks

```typescript
const logger = createLogger({
  config: {
    serviceName: 'hooked-service',
    hooks: [
      // Analytics hook
      (entry) => {
        if (entry.level >= LogLevel.ERROR) {
          // Send to analytics service
          analyticsService.trackError(entry);
        }
      },
      
      // Alerting hook
      async (entry) => {
        if (entry.level === LogLevel.FATAL) {
          await alertService.sendAlert({
            severity: 'critical',
            message: entry.message,
            context: entry.context,
          });
        }
      },
      
      // Metrics hook
      (entry) => {
        metricsService.increment(`logs.${entry.level}`);
        if (entry.context?.duration) {
          metricsService.histogram('log.duration', entry.context.duration);
        }
      },
    ],
  },
  transports: [createConsoleTransport()],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

### Advanced Hook Examples

```typescript
// Performance monitoring hook
const performanceHook = (entry) => {
  if (entry.context?.duration) {
    const duration = entry.context.duration;
    
    // Track slow operations
    if (duration > 1000) {
      metricsService.increment('slow_operations');
    }
    
    // Track operation types
    if (entry.context.operation) {
      metricsService.histogram(`operation.${entry.context.operation}.duration`, duration);
    }
  }
};

// Security monitoring hook
const securityHook = (entry) => {
  const securityKeywords = ['unauthorized', 'forbidden', 'authentication', 'authorization'];
  
  if (securityKeywords.some(keyword => 
    entry.message.toLowerCase().includes(keyword)
  )) {
    securityService.trackSecurityEvent(entry);
  }
};

// Business metrics hook
const businessHook = (entry) => {
  if (entry.context?.orderId) {
    businessMetricsService.trackOrderEvent(entry);
  }
  
  if (entry.context?.userId) {
    userMetricsService.trackUserActivity(entry);
  }
};
```

## 📊 Log Sampling

Log sampling allows you to reduce log volume by only processing a percentage of log entries, which is useful for high-traffic applications.

### Basic Sampling

```typescript
const logger = createLogger({
  config: {
    serviceName: 'sampled-service',
    samplingRate: 0.1, // Only log 10% of entries
  },
  transports: [createConsoleTransport()],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

### Advanced Sampling

```typescript
const logger = createLogger({
  config: {
    serviceName: 'advanced-sampled-service',
    samplingRate: 0.1,
    // Sample different rates for different levels
    filter: (entry) => {
      // Always log errors and fatal
      if (entry.level >= LogLevel.ERROR) return true;
      
      // Sample 5% of info logs
      if (entry.level === LogLevel.INFO) {
        return Math.random() < 0.05;
      }
      
      // Sample 20% of warn logs
      if (entry.level === LogLevel.WARN) {
        return Math.random() < 0.2;
      }
      
      // Sample 1% of debug logs
      if (entry.level === LogLevel.DEBUG) {
        return Math.random() < 0.01;
      }
      
      return true;
    },
  },
  transports: [createConsoleTransport()],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

## ⚡ Rate Limiting

Rate limiting prevents log flooding by limiting the number of logs processed per second.

### Basic Rate Limiting

```typescript
const logger = createLogger({
  config: {
    serviceName: 'rate-limited-service',
    rateLimit: {
      maxLogsPerSecond: 100,
      burstSize: 50,
    },
  },
  transports: [createConsoleTransport()],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

### Advanced Rate Limiting

```typescript
const logger = createLogger({
  config: {
    serviceName: 'advanced-rate-limited-service',
    rateLimit: {
      maxLogsPerSecond: 100,
      burstSize: 50,
    },
    // Different rate limits for different levels
    filter: (entry) => {
      // Apply stricter rate limiting for debug logs
      if (entry.level === LogLevel.DEBUG) {
        return Math.random() < 0.1; // Only 10% of debug logs
      }
      
      return true;
    },
  },
  transports: [createConsoleTransport()],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

## 🔗 Log Enrichment

Log enrichment adds additional context and metadata to log entries automatically.

### Basic Enrichment

```typescript
import { 
  createCorrelationEnricher, 
  createEnvironmentEnricher,
  createUserEnricher 
} from '@cdk-insights/logger';

const logger = createLogger({
  config: {
    serviceName: 'enriched-service',
    // Add correlation IDs, environment info, and user context
    hooks: [
      createCorrelationEnricher().enrich,
      createEnvironmentEnricher('my-service', 'prod').enrich,
      createUserEnricher('user-123').enrich,
    ],
  },
  transports: [createConsoleTransport()],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

### Custom Enrichment

```typescript
const customEnricher = (entry) => {
  return {
    ...entry,
    context: {
      ...entry.context,
      // Add request timing
      requestStartTime: Date.now() - (entry.context?.duration || 0),
      // Add system info
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      // Add business context
      tenantId: getCurrentTenantId(),
      featureFlags: getFeatureFlags(),
    },
  };
};

const logger = createLogger({
  config: {
    serviceName: 'custom-enriched-service',
    hooks: [customEnricher],
  },
  transports: [createConsoleTransport()],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

## 📦 Log Batching

Log batching groups multiple log entries together for more efficient transport, reducing network overhead and improving performance.

### Basic Batching

```typescript
const logger = createLogger({
  config: {
    serviceName: 'batched-service',
    batching: true, // Enable batching
  },
  transports: [createConsoleTransport()],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

### Advanced Batching Configuration

```typescript
import { createBatchedTransport } from '@cdk-insights/logger';

const consoleTransport = createConsoleTransport();
const batchedTransport = createBatchedTransport(consoleTransport, {
  maxSize: 50,        // Maximum 50 logs per batch
  maxWaitTime: 2000,  // Flush after 2 seconds
  maxBatchSize: 1024 * 1024, // 1MB max batch size
});

const logger = createLogger({
  config: { serviceName: 'advanced-batched-service' },
  transports: [batchedTransport],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

## 🔐 Forbidden Keys Filtering/Redaction

The logger provides built-in support for filtering or redacting logs that contain forbidden keys, ensuring sensitive data is never logged.

### Basic Forbidden Keys

```typescript
const logger = createLogger({
  config: {
    serviceName: 'secure-service',
    forbiddenKeys: ['password', 'apiKey', 'secret', 'token'],
    forbiddenKeyAction: 'redact', // or 'skip'
  },
  transports: [createConsoleTransport()],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

### Advanced Forbidden Keys

```typescript
const logger = createLogger({
  config: {
    serviceName: 'advanced-secure-service',
    forbiddenKeys: [
      'password',
      'apiKey', 
      'secret',
      'token',
      'ssn',
      'creditCard',
      'socialSecurity',
      'privateKey',
      'accessToken',
      'refreshToken',
    ],
    forbiddenKeyAction: 'redact', // Redact the values
    // Custom redaction logic
    redact: (entry) => {
      const redacted = { ...entry };
      
      // Redact forbidden keys in message
      if (redacted.message) {
        redacted.message = redacted.message.replace(
          /(password|apiKey|secret|token)\s*[:=]\s*\S+/gi,
          '$1=[REDACTED]'
        );
      }
      
      // Redact forbidden keys in context and metadata
      const redactObject = (obj) => {
        if (!obj) return obj;
        const redacted = { ...obj };
        redacted.forbiddenKeys.forEach(key => {
          if (redacted[key]) {
            redacted[key] = '[REDACTED]';
          }
        });
        return redacted;
      };
      
      redacted.context = redactObject(redacted.context);
      redacted.metadata = redactObject(redacted.metadata);
      
      return redacted;
    },
  },
  transports: [createConsoleTransport()],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

## 🏭 Production Configuration

Here's a comprehensive production configuration that combines multiple advanced features:

```typescript
import { 
  createLogger, 
  createConsoleTransport,
  createDataDogTransport,
  createJsonFormatter,
  getEnvironment,
  LogLevel 
} from '@cdk-insights/logger';

const env = getEnvironment();

const productionLogger = createLogger({
  config: {
    serviceName: 'production-service',
    level: LogLevel.INFO,
    
    // Performance optimizations
    samplingRate: 0.1, // Sample 10% of logs
    rateLimit: {
      maxLogsPerSecond: 1000,
      burstSize: 100,
    },
    batching: true,
    
    // Security
    forbiddenKeys: [
      'password', 'apiKey', 'secret', 'token', 'ssn', 
      'creditCard', 'privateKey', 'accessToken'
    ],
    forbiddenKeyAction: 'redact',
    
    // Validation
    validate: (entry) => {
      if (!entry.message || entry.message.trim().length === 0) {
        throw new Error('Log message cannot be empty');
      }
      if (entry.message.length > 1000) {
        throw new Error('Log message too long');
      }
    },
    
    // Filtering
    filter: (entry) => {
      // Skip health check logs
      if (entry.message.includes('health check')) return false;
      
      // Skip debug logs in production
      if (entry.level === LogLevel.DEBUG) return false;
      
      // Only log errors for non-admin users
      if (entry.level >= LogLevel.ERROR && entry.context?.userRole !== 'admin') {
        return Math.random() < 0.5; // Sample 50% of errors
      }
      
      return true;
    },
    
    // Redaction
    redact: (entry) => {
      const redacted = { ...entry };
      
      // Redact email addresses
      if (redacted.message) {
        redacted.message = redacted.message.replace(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
          '[EMAIL]'
        );
      }
      
      // Redact sensitive context fields
      if (redacted.context) {
        const { password, apiKey, secret, token, ...safeContext } = redacted.context;
        redacted.context = safeContext;
      }
      
      return redacted;
    },
    
    // Hooks for monitoring and alerting
    hooks: [
      // Performance monitoring
      (entry) => {
        if (entry.context?.duration && entry.context.duration > 1000) {
          metricsService.increment('slow_operations');
        }
      },
      
      // Error alerting
      async (entry) => {
        if (entry.level === LogLevel.FATAL) {
          await alertService.sendAlert({
            severity: 'critical',
            message: entry.message,
            context: entry.context,
          });
        }
      },
      
      // Business metrics
      (entry) => {
        if (entry.context?.orderId) {
          businessMetricsService.trackOrderEvent(entry);
        }
      },
    ],
  },
  
  transports: [
    // Console for local development
    ...(env.isDevelopment ? [
      createConsoleTransport({ level: LogLevel.DEBUG })
    ] : []),
    
    // DataDog for production monitoring
    ...(env.isProduction ? [
      createDataDogTransport({
        level: LogLevel.INFO,
        tags: ['env:prod', 'service:production-service'],
        batchSize: 50,
        flushInterval: 2000,
      })
    ] : []),
  ],
  
  formatter: createJsonFormatter(),
  env,
});
```

## 📈 Performance Monitoring

The logger includes built-in performance monitoring capabilities:

```typescript
import { createPerformanceMonitor } from '@cdk-insights/logger';

const performanceMonitor = createPerformanceMonitor();

// Timer-based monitoring
const timer = performanceMonitor.startTimer('databaseQuery');
// ... perform database query ...
const metrics = timer({ table: 'users', operation: 'select' });

// Async function monitoring
const result = await performanceMonitor.timeAsync(
  'apiCall',
  async () => {
    return await fetch('/api/data');
  },
  { endpoint: '/api/data', method: 'GET' }
);

// Sync function monitoring
const syncResult = performanceMonitor.timeSync(
  'dataProcessing',
  () => {
    return processData(largeDataset);
  },
  { datasetSize: largeDataset.length }
);

// Get performance metrics
const summary = performanceMonitor.getMetricsSummary();
const slowest = performanceMonitor.getSlowestExecution();
const avgDuration = performanceMonitor.getAverageDuration('databaseQuery');
```

## 🔗 Correlation Tracking

The logger provides built-in correlation tracking for distributed tracing:

```typescript
import { 
  createCorrelationEnricher,
  generateCorrelationId,
  generateTraceId 
} from '@cdk-insights/logger';

// Generate correlation IDs
const correlationId = generateCorrelationId();
const traceId = generateTraceId();

// Create correlation enricher
const correlationEnricher = createCorrelationEnricher();

const logger = createLogger({
  config: {
    serviceName: 'correlated-service',
    hooks: [correlationEnricher.enrich],
  },
  transports: [createConsoleTransport()],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});

// Use correlation IDs in context
logger.info('Processing request', {
  correlationId,
  traceId,
  requestId: 'req-123',
  userId: 'user-456',
});
```

## 🎯 Best Practices

### **Performance**
- Use sampling for high-traffic applications
- Implement rate limiting to prevent log flooding
- Use batching for remote transports
- Filter out noise at the source

### **Security**
- Always use forbidden keys filtering
- Implement proper redaction for sensitive data
- Validate log entries before processing
- Use environment-specific configurations

### **Monitoring**
- Set up proper alerting for critical errors
- Track performance metrics
- Monitor log volume and costs
- Use correlation IDs for distributed tracing

### **Maintenance**
- Regularly review and update filters
- Monitor transport health and performance
- Keep sampling rates appropriate for your traffic
- Update forbidden keys as your application evolves

## 📚 Additional Resources

- [Third-Party Integrations](./third-party-integrations.md) - Integration guides for popular logging services
- [Error Handling Guide](./error-handling.md) - Comprehensive error handling strategies
- [Log Rotation and File Management](./log-rotation-and-file-management.md) - File-based logging with rotation
- [CloudWatch Log Rotation](./cloudwatch-log-rotation.md) - AWS CloudWatch integration 