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
log.error('Something failed', { orderId: 'order-456' }, new Error('Database timeout'));
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
log.error('Error occurred', {}, new Error('Something broke'));
log.fatal('Critical failure');
```

Set the level via environment variable or config:

```bash
LOG_LEVEL=debug  # Show all logs
LOG_LEVEL=info   # Default in production
```

```typescript
import { logger, LogLevel } from 'strogger';

const log = logger({ level: LogLevel.DEBUG });
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

Send logs to multiple destinations:

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

## Convenience Methods

```typescript
// Function timing
log.logFunctionStart('processOrder');
// ... do work ...
log.logFunctionEnd('processOrder', 150); // duration in ms

// Database operations
log.logDatabaseOperation('SELECT', 'users');

// API requests
log.logApiRequest('POST', '/api/orders', 201);
```

## Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  await log.shutdown(); // Flush all pending logs
  process.exit(0);
});
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
log.debug('Query executed', { sql, params });     // Development debugging
log.info('User registered', { userId });           // Normal operations
log.warn('Rate limit approaching', { current });   // Potential issues
log.error('Payment failed', { orderId }, error);   // Errors that need attention
log.fatal('Database connection lost');             // Critical failures
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

## API Reference

See the [full documentation](docs/api-reference.md) for detailed API reference and advanced features:

- [API Reference](docs/api-reference.md) - Complete function and type documentation
- [Advanced Features](docs/advanced-features.md) - Sampling, rate limiting, batching, hooks
- [Error Handling](docs/error-handling.md) - Error handling strategies
- [Third-Party Integrations](docs/third-party-integrations.md) - CloudWatch, DataDog, Splunk, etc.

## License

MIT
