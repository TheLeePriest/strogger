# Strogger

A structured logging library for Node.js that makes request tracing easy.

[![npm version](https://img.shields.io/npm/v/strogger.svg)](https://www.npmjs.com/package/strogger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## Installation

```bash
npm install strogger
```

## Quick Start

```typescript
import { logger } from 'strogger';

const log = logger({ serviceName: 'my-app' });

log.info('Application started');
log.info('User logged in', { userId: 'user-123' });
log.error('Something failed', { orderId: 'order-456', err: new Error('Database timeout') });

// Before exit, flush pending logs
await log.flush();
```

Or use the pre-configured default logger:

```typescript
import { strogger } from 'strogger';

strogger.info('Quick logging without setup');
```

**Output (development - pretty printed):**
```
12:34:56.789 INFO  Application started
12:34:56.790 INFO  User logged in  userId=user-123
12:34:56.791 ERROR Something failed  orderId=order-456
  Error: Database timeout
    at processOrder (/app/orders.ts:42:11)
```

**Output (production - JSON):**
```json
{"timestamp":"2024-01-15T12:34:56.789Z","level":"INFO","message":"User logged in","userId":"user-123","serviceName":"my-app"}
```

## Request Tracing

The most common need for structured logging is tracing requests through your application. Strogger makes this easy with child loggers:

```typescript
import { logger } from 'strogger';

const log = logger({ serviceName: 'api-server' });

app.use((req, res, next) => {
  // Create a child logger with request context
  req.log = log.child({
    requestId: req.headers['x-request-id'] || crypto.randomUUID(),
    userId: req.user?.id,
    path: req.path,
  });
  next();
});

// In your route handlers:
app.get('/orders/:id', async (req, res) => {
  req.log.info('Fetching order');           // Has requestId, userId, path
  const order = await getOrder(req.params.id);
  req.log.info('Order found', { orderId: order.id });
  res.json(order);
});
```

Every log from `req.log` automatically includes `requestId`, `userId`, and `path` - no need to pass them to each call.

### Express/Fastify Middleware

For even easier setup, use the built-in middleware:

```typescript
import { logger, createRequestLogger, attachLogger } from 'strogger';

const log = logger({ serviceName: 'api' });

// Option 1: Full request logging with timing
app.use(createRequestLogger({
  logger: log,
  timing: true,
  skip: (req) => req.path === '/health',
  getContext: (req) => ({ userId: req.user?.id }),
}));

// Option 2: Just attach a logger to each request
app.use(attachLogger({
  logger: log,
  property: 'log',
  getContext: (req) => ({ userId: req.user?.id }),
}));
```

## Automatic Context Propagation

For complex async flows, use `runWithContext` to automatically propagate context:

```typescript
import { logger, runWithContext, generateRequestContext } from 'strogger';

const log = logger({ serviceName: 'worker' });

// Context flows through all async calls automatically
await runWithContext(
  { ...generateRequestContext(), jobId: 'job-123' },
  async () => {
    log.info('Starting job');      // Has correlationId, traceId, jobId
    await step1();
    await step2();
    log.info('Job complete');      // Same context
  }
);

async function step1() {
  log.info('Processing step 1');   // Still has all context!
}
```

## Sensitive Data Redaction

Automatically redact sensitive data from logs:

```typescript
import { logger, createLogger, createRedactor } from 'strogger';

const log = createLogger({
  config: {
    serviceName: 'secure-api',
    redact: createRedactor(), // Uses sensible defaults
  },
});

// Sensitive data is automatically redacted:
log.info('User email: user@example.com');        // Logs: "User email: [EMAIL]"
log.info('Login', { password: 'secret123' });    // password becomes "[REDACTED]"
log.info('Token: Bearer eyJhbGci...');           // Logs: "Token: Bearer [REDACTED]"
```

The default redactor handles: emails, credit cards, SSNs, API keys, Bearer/Basic tokens, JWTs, AWS keys, and password/secret fields.

## Log Levels

```typescript
log.debug('Detailed debugging info');
log.info('General information');
log.warn('Warning message');
log.error('Error occurred', { err: new Error('Something broke') });
log.fatal('Critical failure');
```

Set the level via environment variable or config:

```bash
LOG_LEVEL=debug  # Show all logs
LOG_LEVEL=info   # Default in production
```

```typescript
import { logger, LogLevel } from 'strogger';

const log = logger({ level: 'debug' });      // String (recommended)
const log2 = logger({ level: LogLevel.DEBUG }); // Enum also works
```

## Configuration

### Simple (recommended)

```typescript
import { logger, LogLevel } from 'strogger';

const log = logger({
  serviceName: 'my-app',     // Identifies your service
  stage: 'production',       // 'dev' | 'staging' | 'prod'
  level: LogLevel.INFO,      // Minimum level to log
  pretty: false,             // Use JSON formatting
});
```

### Environment Variables

```bash
SERVICE_NAME=my-app
STAGE=prod
LOG_LEVEL=info
```

### Advanced

For custom transports and advanced features:

```typescript
import {
  createLogger,
  createConsoleTransport,
  createJsonFormatter,
  createRedactor,
  LogLevel,
} from 'strogger';

const log = createLogger({
  config: {
    serviceName: 'my-app',
    level: LogLevel.DEBUG,
    redact: createRedactor(),
    samplingRate: 0.1, // Sample 10% of logs
  },
  transports: [
    createConsoleTransport({
      formatter: createJsonFormatter(),
      level: LogLevel.DEBUG,
    }),
  ],
});
```

## Transports

Send logs to multiple destinations using shorthand configs:

```typescript
import { logger } from 'strogger';

// Simple - use environment variables for credentials
const log = logger({
  serviceName: 'my-app',
  datadog: true,                              // Uses DATADOG_API_KEY env var
  cloudwatch: { logGroupName: '/app/logs' },  // CloudWatch requires logGroupName
  file: true,                                 // Local file backup
});

// With explicit options
const log2 = logger({
  serviceName: 'my-app',
  datadog: { region: 'eu', tags: ['env:prod'] },
  newrelic: { region: 'eu' },
  elasticsearch: { url: 'https://es.example.com:9200' },
});
```

**Shorthand options:**

| Transport | Shorthand | Environment Variables |
|-----------|-----------|----------------------|
| DataDog | `datadog: true` | `DATADOG_API_KEY`, `DD_SERVICE` |
| CloudWatch | `cloudwatch: { logGroupName }` | `AWS_REGION` |
| Splunk | `splunk: true` | `SPLUNK_HEC_URL`, `SPLUNK_HEC_TOKEN` |
| Elasticsearch | `elasticsearch: true` | `ELASTICSEARCH_URL`, `ELASTICSEARCH_API_KEY` |
| New Relic | `newrelic: true` | `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_ACCOUNT_ID` |
| File | `file: true` | - |

### Advanced Transport Setup

For full control, use `createLogger` with explicit transports:

```typescript
import {
  createLogger,
  createConsoleTransport,
  createCloudWatchTransport,
  createDataDogTransport,
  createJsonFormatter,
} from 'strogger';

const log = createLogger({
  config: { serviceName: 'my-app' },
  transports: [
    createConsoleTransport({ formatter: createJsonFormatter() }),
    createCloudWatchTransport({
      logGroupName: '/aws/lambda/my-function',
      region: 'us-east-1',
    }),
    createDataDogTransport({
      apiKey: process.env.DATADOG_API_KEY,
    }),
  ],
});
```

**Available transports:**
- `createConsoleTransport` - Console output (included by default)
- `createFileTransport` - Local file with rotation
- `createCloudWatchTransport` - AWS CloudWatch Logs
- `createDataDogTransport` - DataDog
- `createSplunkTransport` - Splunk HEC
- `createElasticsearchTransport` - Elasticsearch
- `createNewRelicTransport` - New Relic

## Graceful Shutdown

Strogger automatically registers exit handlers to flush logs, but for explicit control:

```typescript
// Flush pending logs (waits for completion)
await log.flush();

// Full shutdown (flush + close transports)
await log.shutdown();
```

## TypeScript

Full TypeScript support with comprehensive types:

```typescript
import type { Logger, LogContext, LogLevel } from 'strogger';

function processWithLogging(log: Logger, data: unknown): void {
  log.info('Processing', { dataSize: JSON.stringify(data).length });
}
```

## Best Practices

### Use Structured Data

```typescript
// Good - structured and searchable
log.info('Order created', { orderId: 'order-123', amount: 99.99, currency: 'USD' });

// Avoid - hard to parse and search
log.info('Created order order-123 for $99.99 USD');
```

### Use Child Loggers for Request Context

```typescript
// Good - context is automatic
const requestLog = log.child({ requestId, userId });
requestLog.info('Step 1');
requestLog.info('Step 2');

// Avoid - repetitive and error-prone
log.info('Step 1', { requestId, userId });
log.info('Step 2', { requestId, userId });
```

### Use Appropriate Log Levels

```typescript
log.debug('Query executed', { sql, params });         // Development debugging
log.info('User registered', { userId });              // Normal operations
log.warn('Rate limit approaching', { current });      // Potential issues
log.error('Payment failed', { orderId, err: error }); // Errors that need attention
log.fatal('Database connection lost');                // Critical failures
```

## Platform Compatibility

### Node.js (Full Support)

Strogger is designed for Node.js 18+ and uses `AsyncLocalStorage` for automatic context propagation through async operations.

### Browser/Edge (Limited Support)

When `AsyncLocalStorage` is not available (browsers, some edge runtimes), Strogger gracefully falls back to a synchronous context store. This means:

- All core logging features work normally
- `child()` loggers work as expected
- `runWithContext()` works for synchronous code
- **Limitation**: Context may not propagate correctly through some async patterns

To check availability:

```typescript
import { hasAsyncLocalStorage } from 'strogger';

if (!hasAsyncLocalStorage()) {
  console.warn('Context propagation is sync-only in this environment');
}
```

## Performance

Log calls are synchronous and non-blocking - they return immediately while logs are processed in the background via microtasks. This means:

- Logging never blocks your application
- Logs are batched for efficient transport writes
- ~1.4 million logs/second throughput (see `benchmarks/throughput.ts`)

## Migration Guide (v3 → v4)

### Error Logging

```typescript
// v3 - error as separate parameter
log.error('failed', { requestId }, error);

// v4 - error in data object as 'err'
log.error('failed', { requestId, err: error });
```

### String Log Levels

```typescript
// v3 - enum only
log.setLevel(LogLevel.DEBUG);

// v4 - string or enum
log.setLevel('debug');
log.setLevel(LogLevel.DEBUG);  // still works
```

### Async Handling

```typescript
// v3 - await each log (optional)
await log.info('message');

// v4 - fire and forget, flush when needed
log.info('message');
await log.flush();  // only when you need to wait
```

### Convenience Methods Removed

The built-in convenience methods (`logFunctionStart`, `logFunctionEnd`, `logDatabaseOperation`, `logApiRequest`) have been removed. Use standard logging with descriptive messages instead:

```typescript
// v3
log.logFunctionStart('processOrder');
log.logFunctionEnd('processOrder', 150);

// v4
log.info('Function processOrder started', { functionName: 'processOrder' });
log.info('Function processOrder completed', { functionName: 'processOrder', duration: 150 });
```

## Error Handling

Transport errors (network failures, missing credentials) are handled gracefully - they won't crash your application. By default, errors are logged to console. Customize with:

```typescript
const log = logger({
  serviceName: 'my-app',
  datadog: true,
  onError: (error, transportName) => {
    // Custom error handling (e.g., send to error tracking service)
    console.error(`[${transportName}] ${error.message}`);
  },
});
```

If a transport's required credentials are missing (e.g., `datadog: true` without `DATADOG_API_KEY`), the logger will throw at creation time with a helpful error message.

## License

MIT
