# API Reference

## Core Functions

### `logger(options?)`

Create a logger with sensible defaults. **Recommended for most use cases.**

```typescript
import { logger } from 'strogger';

const log = logger({
  serviceName: 'my-app',  // Optional
  stage: 'prod',          // Optional, detected from STAGE env var
  level: LogLevel.INFO,   // Optional, defaults based on stage
  pretty: false,          // Optional, auto-detected based on stage
});
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serviceName` | `string` | `SERVICE_NAME` env | Service name for log identification |
| `stage` | `string` | `STAGE` env or `'dev'` | Environment stage |
| `level` | `LogLevel` | `INFO` in prod, `DEBUG` otherwise | Minimum log level |
| `pretty` | `boolean` | `true` in dev | Use pretty printing for console |
| `transports` | `Transport[]` | `[]` | Additional transports |
| `onError` | `TransportErrorHandler` | Console error | Error handler for transport failures |

### `createLogger(options?)`

Create a logger with full configuration options.

```typescript
import { createLogger, createConsoleTransport, createJsonFormatter } from 'strogger';

const log = createLogger({
  config: {
    serviceName: 'my-app',
    level: LogLevel.DEBUG,
    samplingRate: 0.1,
    redact: createRedactor(),
  },
  transports: [
    createConsoleTransport({ formatter: createJsonFormatter() }),
  ],
});
```

### `strogger`

Pre-configured default logger instance.

```typescript
import { strogger } from 'strogger';

strogger.info('Quick logging without setup');
```

## Logger Instance Methods

### Logging Methods

```typescript
log.debug(message: string, context?: LogContext, metadata?: object): Promise<void>
log.info(message: string, context?: LogContext, metadata?: object): Promise<void>
log.warn(message: string, context?: LogContext, error?: Error, metadata?: object): Promise<void>
log.error(message: string, context?: LogContext, error?: Error, metadata?: object): Promise<void>
log.fatal(message: string, context?: LogContext, error?: Error, metadata?: object): Promise<void>
```

### Child Loggers

```typescript
const childLog = log.child(context: LogContext): Logger
```

Creates a new logger that inherits settings but adds additional context to every log.

```typescript
const requestLog = log.child({ requestId: 'req-123', userId: 'user-456' });
requestLog.info('Processing'); // Includes requestId and userId
```

### Convenience Methods

```typescript
log.logFunctionStart(functionName: string, context?, metadata?): Promise<void>
log.logFunctionEnd(functionName: string, duration: number, context?, metadata?): Promise<void>
log.logDatabaseOperation(operation: string, table: string, context?, metadata?): Promise<void>
log.logApiRequest(method: string, path: string, statusCode: number, context?, metadata?): Promise<void>
```

### Management Methods

```typescript
log.setLevel(level: LogLevel): void
log.getLevel(): LogLevel
log.getInstanceId(): string
log.addTransport(transport: Transport): void
log.removeTransport(transport: Transport): void
log.getSamplingStats(): SamplingStats
log.getBatchStats(): BatchStats[]
log.flush(): Promise<void>
log.shutdown(): Promise<void>
```

## Context & Tracing

### `runWithContext(context, fn)`

Run a function with context that propagates through async operations.

```typescript
import { runWithContext, getContext } from 'strogger';

runWithContext({ requestId: 'req-123' }, () => {
  // Context is available here and in any async calls
  console.log(getContext().requestId); // 'req-123'
});
```

### `runWithContextAsync(context, fn)`

Same as `runWithContext` but explicitly for async functions.

```typescript
await runWithContextAsync({ requestId: 'req-123' }, async () => {
  await someAsyncOperation();
  // Context still available
});
```

### `getContext()`

Get the current context from AsyncLocalStorage.

```typescript
const context = getContext();
// { requestId: '...', userId: '...', ... }
```

### `setContext(context)`

Merge values into the current context.

```typescript
runWithContext({ requestId: 'req-123' }, () => {
  setContext({ userId: 'user-456' });
  // Context now has both requestId and userId
});
```

### `generateRequestContext()`

Generate a new context with correlation IDs.

```typescript
const context = generateRequestContext();
// { correlationId: 'req_...', traceId: '...', spanId: '...' }
```

### `hasAsyncLocalStorage()`

Check if AsyncLocalStorage is available (returns `false` in browsers).

```typescript
if (!hasAsyncLocalStorage()) {
  console.warn('Context propagation is not async-safe in this environment');
}
```

## Middleware

### `createRequestLogger(options)`

Create Express/Fastify/Koa request logging middleware.

```typescript
import { createRequestLogger, logger } from 'strogger';

const log = logger({ serviceName: 'api' });

app.use(createRequestLogger({
  logger: log,
  timing: true,
  skip: (req) => req.path === '/health',
  getContext: (req) => ({
    userId: req.user?.id,
  }),
}));
```

### `attachLogger(options)`

Attach a child logger to each request.

```typescript
import { attachLogger, logger } from 'strogger';

const log = logger({ serviceName: 'api' });

app.use(attachLogger({
  logger: log,
  property: 'log', // req.log
  getContext: (req) => ({ userId: req.user?.id }),
}));

// In routes:
app.get('/users', (req, res) => {
  req.log.info('Fetching users'); // Has request context
});
```

### `createTimingMiddleware(options)`

Middleware that warns about slow requests.

```typescript
app.use(createTimingMiddleware({
  logger: log,
  warnThreshold: 1000, // Warn if > 1 second
}));
```

## Redaction

### `createRedactor(options?)`

Create a redaction function with configurable options.

```typescript
import { createRedactor } from 'strogger';

const redact = createRedactor({
  additionalFields: ['internalId'],
  additionalPatterns: [
    { pattern: /CUSTOM-\d+/g, replacement: '[CUSTOM]' },
  ],
});
```

### `defaultRedactor`

Pre-configured redactor with default settings.

```typescript
import { defaultRedactor } from 'strogger';

const redacted = defaultRedactor(logEntry);
```

### `DEFAULT_SENSITIVE_FIELDS`

Array of field names redacted by default:
- `password`, `passwd`, `pwd`
- `secret`, `apiKey`, `api_key`
- `token`, `accessToken`, `refreshToken`
- `authorization`, `auth`, `credentials`
- `private_key`, `privateKey`
- `ssn`, `socialSecurity`
- `creditCard`, `cardNumber`, `cvv`, `cvc`, `pin`

## Formatters

### `createJsonFormatter()`

Create a JSON formatter for structured output.

```typescript
const formatter = createJsonFormatter();
// Output: {"timestamp":"...","level":"INFO","message":"..."}
```

### `createPrettyFormatter(options?)`

Create a human-readable formatter for development.

```typescript
const formatter = createPrettyFormatter({
  colors: true,      // Use ANSI colors
  showTimestamp: true,
  showContext: true,
});
// Output: 12:34:56.789 INFO  Message  requestId=req-123
```

## Transports

### `createConsoleTransport(options?)`

```typescript
const transport = createConsoleTransport({
  formatter: createJsonFormatter(),
  level: LogLevel.DEBUG,
});
```

### `createFileTransport(options)`

```typescript
const transport = createFileTransport({
  path: '/var/log/app.log',
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
});
```

### `createCloudWatchTransport(options)`

```typescript
const transport = createCloudWatchTransport({
  logGroupName: '/aws/lambda/my-function',
  region: 'us-east-1',
});
```

### `createDataDogTransport(options)`

```typescript
const transport = createDataDogTransport({
  apiKey: process.env.DATADOG_API_KEY,
});
```

### Other Transports

- `createSplunkTransport(options)` - Splunk HEC
- `createElasticsearchTransport(options)` - Elasticsearch
- `createNewRelicTransport(options)` - New Relic

## Types

### `LogLevel`

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}
```

### `LogContext`

```typescript
interface LogContext {
  requestId?: string;
  userId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}
```

### `LogEntry`

```typescript
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: SerializedError;
  metadata?: Record<string, unknown>;
}
```

### `SerializedError`

```typescript
interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  statusCode?: number;
  cause?: SerializedError;
}
```

### `Logger`

```typescript
interface Logger {
  debug(message: string, context?, metadata?): Promise<void>;
  info(message: string, context?, metadata?): Promise<void>;
  warn(message: string, context?, error?, metadata?): Promise<void>;
  error(message: string, context?, error?, metadata?): Promise<void>;
  fatal(message: string, context?, error?, metadata?): Promise<void>;
  child(context: LogContext): Logger;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
  shutdown(): Promise<void>;
  // ... and more
}
```
