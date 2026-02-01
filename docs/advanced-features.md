# Advanced Features Guide

This guide covers the advanced features available in the `strogger` library, including log filtering, validation, redaction, hooks, sampling, rate limiting, enrichment, batching, and security features.

## Table of Contents

1. [Log Filtering](#log-filtering)
2. [Log Validation](#log-validation)
3. [Log Redaction](#log-redaction)
4. [Custom Hooks](#custom-hooks)
5. [Log Sampling](#log-sampling)
6. [Rate Limiting](#rate-limiting)
7. [Log Enrichment](#log-enrichment)
8. [Log Batching](#log-batching)
9. [Forbidden Keys Filtering](#forbidden-keys-filtering)
10. [Production Configuration](#production-configuration)
11. [Performance Monitoring](#performance-monitoring)
12. [Correlation Tracking](#correlation-tracking)

## Log Filtering

Log filtering allows you to control which log entries are processed and sent to transports.

### Basic Filtering

```typescript
import { createLogger, LogLevel } from 'strogger';

const log = createLogger({
  config: {
    serviceName: 'filtered-service',
    filter: (entry) => {
      // Only log errors and warnings
      if (entry.level >= LogLevel.WARN) return true;

      // Only log requests for admin users
      if (entry.context?.userId === 'admin') return true;

      return false;
    },
  },
});
```

### Advanced Filtering Examples

```typescript
// Filter by message content
const messageFilter = (entry) => {
  // Skip health check logs
  if (entry.message.includes('health check')) return false;
  return true;
};

// Filter by context
const contextFilter = (entry) => {
  // Skip logs from test users
  if (entry.context?.userId?.startsWith('test-')) {
    return false;
  }
  return true;
};
```

## Log Validation

Log validation ensures that log entries meet your quality standards before they are processed.

```typescript
const log = createLogger({
  config: {
    serviceName: 'validated-service',
    validate: (entry) => {
      // Ensure message is not empty
      if (!entry.message || entry.message.trim().length === 0) {
        throw new Error('Log message cannot be empty');
      }

      // Validate message length
      if (entry.message.length > 1000) {
        throw new Error('Log message too long');
      }
    },
  },
});
```

## Log Redaction

Log redaction automatically removes or masks sensitive information from log entries.

### Using the Built-in Redactor

```typescript
import { createLogger, createRedactor } from 'strogger';

// Use default redaction (passwords, API keys, emails, credit cards, etc.)
const log = createLogger({
  config: {
    serviceName: 'secure-service',
    redact: createRedactor(),
  },
});

// Messages and context are automatically redacted:
log.info('User email: user@example.com'); // Logs: "User email: [EMAIL]"
log.info('Login', { password: 'secret' }); // Context password becomes "[REDACTED]"
```

### Custom Redaction

```typescript
import { createRedactor } from 'strogger';

const redact = createRedactor({
  // Add custom sensitive fields
  additionalFields: ['internalId', 'sessionToken'],

  // Add custom patterns
  additionalPatterns: [
    { pattern: /CUSTOM-\d{4}/g, replacement: '[CUSTOM_ID]' },
  ],

  // Custom replacement string
  fieldReplacement: '***HIDDEN***',
});

const log = createLogger({
  config: {
    serviceName: 'custom-secure',
    redact,
  },
});
```

### Default Redaction Patterns

The built-in redactor handles:
- Email addresses → `[EMAIL]`
- Credit card numbers → `[CARD]`
- Social Security Numbers → `[SSN]`
- Bearer tokens → `Bearer [REDACTED]`
- Basic auth → `Basic [REDACTED]`
- JWT tokens → `[JWT]`
- AWS access keys → `[AWS_KEY]`
- Password/secret/token in key=value format → `password=[REDACTED]`

## Custom Hooks

Custom hooks allow you to execute custom logic when logs are processed.

```typescript
const log = createLogger({
  config: {
    serviceName: 'hooked-service',
    hooks: [
      // Analytics hook
      (entry) => {
        if (entry.level >= LogLevel.ERROR) {
          analyticsService.trackError(entry);
        }
      },

      // Alerting hook
      async (entry) => {
        if (entry.level === LogLevel.FATAL) {
          await alertService.sendAlert({
            severity: 'critical',
            message: entry.message,
          });
        }
      },
    ],
  },
});
```

## Log Sampling

Log sampling reduces log volume by only processing a percentage of log entries.

```typescript
const log = createLogger({
  config: {
    serviceName: 'sampled-service',
    samplingRate: 0.1, // Only log 10% of entries
  },
});
```

## Rate Limiting

Rate limiting prevents log flooding by limiting the number of logs processed per second.

```typescript
const log = createLogger({
  config: {
    serviceName: 'rate-limited-service',
    rateLimit: {
      maxLogsPerSecond: 100,
      burstSize: 50,
    },
  },
});
```

## Log Enrichment

Log enrichment adds additional context and metadata to log entries automatically.

### Using Child Loggers (Recommended)

```typescript
import { logger } from 'strogger';

const log = logger({ serviceName: 'enriched-service' });

// Create a child logger with request context
const requestLog = log.child({
  requestId: 'req-123',
  userId: 'user-456',
  tenantId: 'tenant-789',
});

// All logs from requestLog include the context
requestLog.info('Processing'); // Has requestId, userId, tenantId
requestLog.info('Done');       // Same context
```

### Using AsyncLocalStorage Context

```typescript
import { logger, runWithContext, generateRequestContext } from 'strogger';

const log = logger({ serviceName: 'enriched-service' });

// Context flows through async operations automatically
app.use((req, res, next) => {
  runWithContext({
    ...generateRequestContext(),
    userId: req.user?.id,
  }, () => {
    next();
  });
});

// In any handler, context is automatically included
async function handleRequest() {
  log.info('Processing'); // Includes correlationId, traceId, userId
  await someAsyncOperation();
  log.info('Done');       // Still has context!
}
```

## Log Batching

Log batching groups multiple log entries together for more efficient transport.

```typescript
const log = createLogger({
  config: {
    serviceName: 'batched-service',
    batching: true,
  },
});
```

### Advanced Batching Configuration

```typescript
import { createBatchedTransport, createConsoleTransport } from 'strogger';

const consoleTransport = createConsoleTransport();
const batchedTransport = createBatchedTransport(consoleTransport, {
  maxSize: 50,        // Maximum 50 logs per batch
  maxWaitTime: 2000,  // Flush after 2 seconds
  maxBatchSize: 1024 * 1024, // 1MB max batch size
});
```

## Forbidden Keys Filtering

Prevent logs containing certain keys from being processed.

```typescript
const log = createLogger({
  config: {
    serviceName: 'secure-service',
    forbiddenKeys: ['password', 'apiKey', 'secret'],
    forbiddenKeyAction: 'redact', // or 'skip'
  },
});
```

## Production Configuration

Here's a comprehensive production configuration:

```typescript
import { createLogger, createRedactor, LogLevel } from 'strogger';

const log = createLogger({
  config: {
    serviceName: 'production-service',
    level: LogLevel.INFO,

    // Performance optimizations
    samplingRate: 0.1,
    rateLimit: {
      maxLogsPerSecond: 1000,
      burstSize: 100,
    },
    batching: true,

    // Security
    redact: createRedactor(),
    forbiddenKeys: ['password', 'secret', 'token'],
    forbiddenKeyAction: 'redact',

    // Validation
    validate: (entry) => {
      if (!entry.message || entry.message.length > 1000) {
        throw new Error('Invalid log message');
      }
    },

    // Hooks for monitoring
    hooks: [
      (entry) => {
        if (entry.level >= LogLevel.ERROR) {
          metricsService.increment('errors');
        }
      },
    ],
  },
});
```

## Performance Monitoring

The library includes built-in performance monitoring:

```typescript
import { createPerformanceMonitor } from 'strogger';

const monitor = createPerformanceMonitor();

// Timer-based monitoring
const timer = monitor.startTimer('databaseQuery');
// ... perform operation ...
const metrics = timer({ table: 'users', operation: 'select' });

// Async function monitoring
const result = await monitor.timeAsync(
  'apiCall',
  async () => {
    return await fetch('/api/data');
  },
  { endpoint: '/api/data' }
);

// Get performance summary
const summary = monitor.getMetricsSummary();
```

## Correlation Tracking

Use correlation IDs for distributed tracing:

```typescript
import { logger, runWithContext, generateRequestContext } from 'strogger';

const log = logger({ serviceName: 'service-a' });

// Generate and propagate correlation context
const context = generateRequestContext();
// context = { correlationId, traceId, spanId }

// Use in requests to other services
await fetch('http://service-b/api', {
  headers: {
    'x-correlation-id': context.correlationId,
    'x-trace-id': context.traceId,
  },
});

// Or use runWithContext for automatic propagation
runWithContext(context, async () => {
  log.info('Starting operation'); // Has correlationId
  await callServiceB();
  log.info('Operation complete'); // Same correlationId
});
```

## Best Practices

### Performance
- Use sampling for high-traffic applications
- Implement rate limiting to prevent log flooding
- Use batching for remote transports
- Filter out noise at the source

### Security
- Always use redaction for sensitive data
- Validate log entries before processing
- Use environment-specific configurations

### Monitoring
- Set up alerting for critical errors
- Track performance metrics
- Use correlation IDs for distributed tracing

### Maintenance
- Regularly review and update filters
- Monitor log volume and costs
- Keep sampling rates appropriate for your traffic

## Additional Resources

- [Third-Party Integrations](./third-party-integrations.md) - Integration guides for popular logging services
- [Error Handling Guide](./error-handling.md) - Comprehensive error handling strategies
- [Log Rotation and File Management](./log-rotation-and-file-management.md) - File-based logging with rotation
- [CloudWatch Log Rotation](./cloudwatch-log-rotation.md) - AWS CloudWatch integration
