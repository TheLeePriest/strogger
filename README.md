# Strogger

A modern, **structured logging** library built with functional programming principles, dependency injection, and duck-typing for maximum flexibility and extensibility.

## 🎯 **Core Focus: Structured Logging**

This library is built around the principle that **all logs should be structured data**. Every log entry is automatically formatted as structured JSON with a consistent schema, making logs easy to parse, search, and analyze.

### **Why Structured Logging?**

- **🔍 Searchable**: JSON format enables powerful log searching and filtering
- **📊 Analyzable**: Structured data can be easily aggregated and analyzed
- **🔗 Correlatable**: Consistent schema enables correlation across services
- **🤖 Machine-readable**: Perfect for log aggregation systems and monitoring tools
- **📈 Scalable**: Efficient parsing and storage in modern logging systems

## 🚀 Features

- **📊 Structured JSON Logging** (Core Focus): All logs automatically formatted as structured JSON with consistent schema
- **🔄 Functional Programming**: Pure functions with dependency injection and duck-typing
- **🚚 Multiple Transports**: Console, DataDog, Splunk, Elasticsearch, New Relic, CloudWatch, File, and custom transports
- **🌍 Environment-aware**: Automatic configuration based on environment variables
- **📝 TypeScript Support**: Full TypeScript support with comprehensive type definitions
- **⚡ AWS Lambda Optimized**: Designed to work seamlessly in AWS Lambda environments
- **🔧 Extensible**: Easy to add custom transports and formatters using duck-typing
- **📈 Performance Monitoring**: Built-in performance tracking and metrics
- **🛡️ Comprehensive Error Handling**: Clear, actionable error messages with solutions
- **🔍 Advanced Features**: Log filtering, validation, redaction, sampling, rate limiting, enrichment, and batching
- **🔐 Security**: Built-in support for forbidden keys filtering and redaction

## 📦 Installation

```bash
npm install strogger
```

## 🎯 Quick Start

### Basic Usage

```typescript
import { strogger } from 'strogger';

// Simple logging
strogger.info('Application started');
strogger.debug('Processing request', { requestId: '123' });
strogger.warn('Deprecated feature used');
strogger.error('Something went wrong', { userId: '456' }, new Error('Database connection failed'));
```

### Branded vs Conventional APIs

Strogger provides both conventional and branded function names:

```typescript
// Conventional approach (recommended for most users)
import { createLogger, createConsoleTransport } from 'strogger';

// Branded approach (for brand consistency)
import { createStrogger, createStroggerConsoleTransport } from 'strogger';

// Both work identically:
const logger = createLogger({...});
const strogger = createStrogger({...});
```

### Functional Approach with Dependency Injection

```typescript
import { 
  createLogger, 
  createConsoleTransport, 
  createJsonFormatter, 
  getEnvironment,
  LogLevel 
} from 'strogger';

// Or using branded functions:
// import { 
//   createStrogger, 
//   createStroggerConsoleTransport, 
//   createJsonFormatter, 
//   getEnvironment,
//   LogLevel 
// } from 'strogger';

// Get environment configuration
const env = getEnvironment();

// Create dependencies
const formatter = createJsonFormatter();
const transport = createConsoleTransport({ 
  formatter, 
  level: LogLevel.DEBUG 
});

// Create logger with dependency injection
const logger = createLogger({
  config: { 
    serviceName: 'my-service', 
    stage: 'dev' 
  },
  transports: [transport],
  formatter,
  env,
});

// Use the logger
logger.info('Application started with functional approach');
```

### With Context and Metadata

```typescript
import { strogger } from 'strogger';

const context = {
  requestId: 'req-123',
  userId: 'user-456',
  functionName: 'processPayment'
};

const metadata = {
  orderId: 'order-789',
  amount: 100.50,
  currency: 'USD'
};

strogger.info('Payment processing started', context);
strogger.debug('Validating payment details', context, metadata);
```

### Convenience Methods

```typescript
import { strogger } from 'strogger';

// Function lifecycle logging
strogger.logFunctionStart('processOrder', { orderId: 'order-123' });
// ... function logic ...
strogger.logFunctionEnd('processOrder', 150, { orderId: 'order-123' });

// Database operations
strogger.logDatabaseOperation('SELECT', 'users', { table: 'users' });

// API requests
strogger.logApiRequest('POST', '/api/orders', 201, { orderId: 'order-123' });
```

## ⚙️ Configuration

### Environment Variables

The logger automatically configures itself based on environment variables:

```bash
# Log level (DEBUG, INFO, WARN, ERROR, FATAL)
LOG_LEVEL=INFO

# Environment stage
STAGE=dev

# Service name
SERVICE_NAME=my-service

# Enable structured logging (default: true)
ENABLE_STRUCTURED_LOGGING=true

# Third-party integrations
DATADOG_API_KEY=your-datadog-api-key
SPLUNK_HEC_URL=https://your-splunk-instance:8088/services/collector
SPLUNK_HEC_TOKEN=your-splunk-hec-token
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_API_KEY=your-elasticsearch-api-key
NEW_RELIC_LICENSE_KEY=your-newrelic-license-key
NEW_RELIC_ACCOUNT_ID=your-newrelic-account-id
```

### Custom Configuration

```typescript
import { 
  createLogger, 
  LogLevel, 
  createConsoleTransport, 
  createJsonFormatter,
  getEnvironment 
} from 'strogger';

const env = getEnvironment();
const formatter = createJsonFormatter();
const transport = createConsoleTransport({ 
  formatter, 
  useColors: false 
});

const customLogger = createLogger({
  config: {
    level: LogLevel.DEBUG,
    serviceName: 'my-service',
    stage: 'dev',
    enableStructuredLogging: true,
    // Advanced features
    samplingRate: 0.1, // Sample 10% of logs
    rateLimit: {
      maxLogsPerSecond: 100,
      burstSize: 50
    },
    forbiddenKeys: ['password', 'apiKey', 'secret'],
    forbiddenKeyAction: 'redact' // or 'skip'
  },
  transports: [transport],
  formatter,
  env,
});
```

## 🔌 Third-Party Integrations

### DataDog Integration

```typescript
import { createDataDogTransport } from 'strogger';
// Or: import { createStroggerDataDogTransport } from 'strogger';

const dataDogTransport = createDataDogTransport({
  level: LogLevel.INFO,
  apiKey: process.env.DATADOG_API_KEY,
  serviceName: 'my-service',
  tags: ['env:prod', 'team:backend']
});

const logger = createLogger({
  config: { serviceName: 'my-service' },
  transports: [dataDogTransport],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

### Splunk Integration

```typescript
import { createSplunkTransport } from 'strogger';
// Or: import { createStroggerSplunkTransport } from 'strogger';

const splunkTransport = createSplunkTransport({
  level: LogLevel.INFO,
  hecUrl: process.env.SPLUNK_HEC_URL,
  hecToken: process.env.SPLUNK_HEC_TOKEN,
  source: 'my-service',
  sourcetype: '_json'
});

const logger = createLogger({
  config: { serviceName: 'my-service' },
  transports: [splunkTransport],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

### Elasticsearch Integration

```typescript
import { createElasticsearchTransport } from 'strogger';
// Or: import { createStroggerElasticsearchTransport } from 'strogger';

const elasticsearchTransport = createElasticsearchTransport({
  level: LogLevel.INFO,
  url: process.env.ELASTICSEARCH_URL,
  apiKey: process.env.ELASTICSEARCH_API_KEY,
  index: 'logs',
  indexPattern: 'logs-{YYYY.MM.DD}'
});

const logger = createLogger({
  config: { serviceName: 'my-service' },
  transports: [elasticsearchTransport],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

### New Relic Integration

```typescript
import { createNewRelicTransport } from 'strogger';
// Or: import { createStroggerNewRelicTransport } from 'strogger';

const newRelicTransport = createNewRelicTransport({
  level: LogLevel.INFO,
  apiKey: process.env.NEW_RELIC_LICENSE_KEY,
  accountId: process.env.NEW_RELIC_ACCOUNT_ID,
  serviceName: 'my-service'
});

const logger = createLogger({
  config: { serviceName: 'my-service' },
  transports: [newRelicTransport],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

## 🔧 Advanced Usage

### Custom Transports with Duck-Typing

```typescript
import { createLogger, LogLevel } from 'strogger';

// Any object with log/setLevel/getLevel methods works (duck-typing)
const customTransport = {
  log: (entry: any) => {
    // Custom logging logic
    console.log(`[CUSTOM] ${JSON.stringify(entry)}`);
  },
  setLevel: (level: LogLevel) => {
    console.log(`Setting custom transport level to ${level}`);
  },
  getLevel: () => LogLevel.INFO,
};

const logger = createLogger({
  config: { serviceName: 'service-with-custom-transport' },
  transports: [customTransport], // Duck-typing in action
  formatter: { format: (entry: any) => JSON.stringify(entry) },
  env: getEnvironment(),
});
```

### Custom Formatters with Duck-Typing

```typescript
import { createLogger } from 'strogger';

// Any object with a 'format' method works (duck-typing)
const simpleFormatter = {
  format: (entry: any) => `${entry.timestamp} [${entry.level}] ${entry.message}`,
};

const logger = createLogger({
  config: { serviceName: 'simple-formatter-service' },
  transports: [],
  formatter: simpleFormatter, // Duck-typing in action
  env: getEnvironment(),
});
```

### Performance Monitoring

```typescript
import { createPerformanceMonitor } from 'strogger';

const performanceMonitor = createPerformanceMonitor();

// Timer-based monitoring
const timer = performanceMonitor.startTimer('myFunction');
// ... do work ...
const metrics = timer({ userId: '123', operation: 'data-processing' });

// Async function monitoring
const result = await performanceMonitor.timeAsync(
  'asyncOperation',
  async () => {
    // Your async function
    return 'result';
  },
  { operation: 'async-example' }
);

// Sync function monitoring
const syncResult = performanceMonitor.timeSync(
  'syncOperation',
  () => {
    // Your sync function
    return 'result';
  },
  { operation: 'sync-example' }
);

// Get performance metrics
const summary = performanceMonitor.getMetricsSummary();
const slowest = performanceMonitor.getSlowestExecution();
const avgDuration = performanceMonitor.getAverageDuration('myFunction');
```

### Multiple Transports

```typescript
import { 
  createLogger, 
  createConsoleTransport,
  createDataDogTransport,
  createSplunkTransport,
  getEnvironment 
} from 'strogger';

const env = getEnvironment();
const formatter = createJsonFormatter();

const logger = createLogger({
  config: { serviceName: 'multi-transport-service' },
  transports: [
    createConsoleTransport({ formatter, level: LogLevel.DEBUG }), // Console for all levels
    createDataDogTransport({ level: LogLevel.INFO }), // DataDog for INFO+
    createSplunkTransport({ level: LogLevel.ERROR }), // Splunk for ERROR+
  ],
  formatter,
  env,
});
```

## 📊 Log Levels

- **DEBUG (0)**: Detailed information for debugging
- **INFO (1)**: General information about application flow
- **WARN (2)**: Warning messages for potentially harmful situations
- **ERROR (3)**: Error events that might still allow the application to continue
- **FATAL (4)**: Severe errors that will prevent the application from running

## 📝 Structured JSON Output Format

**Every log entry is automatically formatted as structured JSON** with a consistent schema. This ensures all logs are machine-readable and easily parseable by logging systems.

### **Standard Log Entry Schema**

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "message": "Function processOrder started",
  "stage": "dev",
  "serviceName": "order-service",
  "requestId": "req-123",
  "functionName": "processOrder",
  "correlationId": "corr-abc123",
  "traceId": "trace-def456",
  "instanceId": "inst-789",
  "metadata": {
    "orderId": "order-456",
    "userId": "user-123"
  }
}
```

### **Error Log Entry Schema**

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "ERROR",
  "message": "Database connection failed",
  "stage": "prod",
  "serviceName": "payment-service",
  "requestId": "req-789",
  "error": {
    "name": "ConnectionError",
    "message": "Failed to connect to database",
    "stack": "ConnectionError: Failed to connect..."
  },
  "context": {
    "database": "primary",
    "retryAttempts": 3
  }
}
```

### **Benefits of Structured JSON Logging**

- **🔍 Consistent Schema**: All logs follow the same structure
- **📊 Easy Parsing**: JSON format is universally supported
- **🔗 Correlation**: Built-in correlation IDs for distributed tracing
- **📈 Analytics**: Structured data enables powerful log analytics
- **🤖 Automation**: Machine-readable format for automated processing

## 🔄 Migration from Class-Based Logger

If you're migrating from the class-based logger:

### Before (Class-based)
```typescript
import { Logger } from 'strogger';

const logger = new Logger({
  config: { serviceName: 'my-service' },
  transports: [new ConsoleTransport()],
  formatter: new JsonFormatter(),
});
```

### After (Functional)
```typescript
import { 
  createLogger, 
  createConsoleTransport, 
  createJsonFormatter,
  getEnvironment 
} from 'strogger';

const env = getEnvironment();
const formatter = createJsonFormatter();
const transport = createConsoleTransport({ formatter });

const logger = createLogger({
  config: { serviceName: 'my-service' },
  transports: [transport],
  formatter,
  env,
});
```

## 📚 API Reference

### Core Functions

- `createLogger(options)`: Creates a logger instance with dependency injection
- `createConsoleTransport(options)`: Creates a console transport
- `createJsonFormatter()`: Creates a JSON formatter
- `getEnvironment(env?)`: Gets environment configuration
- `createPerformanceMonitor(initialState?)`: Creates a performance monitor

### Transport Functions

- `createDataDogTransport(options)`: Creates a DataDog transport
- `createSplunkTransport(options)`: Creates a Splunk transport
- `createElasticsearchTransport(options)`: Creates an Elasticsearch transport
- `createNewRelicTransport(options)`: Creates a New Relic transport

### Duck-Typing Interfaces

**Transport**: Any object with `log(entry)`, optional `setLevel(level)`, and optional `getLevel()` methods.

**Formatter**: Any object with a `format(entry)` method.

**Performance Monitor**: Returns an object with performance tracking methods.

### Error Handling

The logger provides comprehensive error handling with clear, actionable error messages:

```typescript
import { 
  LoggerError, 
  TransportError, 
  ERROR_MESSAGES,
  handleTransportError 
} from '@cdk-insights/logger';

// Custom error handling
try {
  const logger = createLogger({ /* config */ });
} catch (error) {
  if (error instanceof TransportError) {
    console.error(`Transport ${error.transportName} failed:`, error.message);
    console.error('Solution:', error.details?.solution);
  }
}
```

## 📖 Documentation

- [Advanced Features Guide](./docs/advanced-features.md) - Log filtering, validation, redaction, hooks, sampling, rate limiting, enrichment, and batching
- [Third-Party Integrations](./docs/third-party-integrations.md) - Detailed integration guides for DataDog, Splunk, Elasticsearch, New Relic, and custom transports
- [Error Handling Guide](./docs/error-handling.md) - Comprehensive error handling with examples and best practices
- [Log Rotation and File Management](./docs/log-rotation-and-file-management.md) - File-based logging with rotation and management
- [CloudWatch Log Rotation](./docs/cloudwatch-log-rotation.md) - AWS CloudWatch integration with log rotation
- [Release Workflow](./docs/release-workflow.md) - Automated release process using bumper-cli

## 🤝 Contributing

This library follows functional programming principles:
- Pure functions with explicit dependencies
- Duck-typing for extensibility
- Immutable data structures where possible
- Composition over inheritance

## 📄 License

MIT License - see LICENSE file for details. 