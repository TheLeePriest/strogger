# 📊 Strogger

> 📊 A modern structured logging library with functional programming, duck-typing, and comprehensive third-party integrations

[![npm version](https://img.shields.io/npm/v/strogger.svg?style=flat-square)](https://www.npmjs.com/package/strogger)
[![npm downloads](https://img.shields.io/npm/dm/strogger.svg?style=flat-square)](https://www.npmjs.com/package/strogger)
[![GitHub stars](https://img.shields.io/github/stars/TheLeePriest/strogger?style=flat-square)](https://github.com/TheLeePriest/strogger/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)

Strogger is a modern, developer-friendly structured logging library built with functional programming principles, dependency injection, and duck-typing for maximum flexibility and extensibility.

## 🎯 **Core Focus: Structured Logging**

This library is built around the principle that **all logs should be structured data**. Every log entry is automatically formatted as structured JSON with a consistent schema, making logs easy to parse, search, and analyze.

### **Why Structured Logging?**

- **🔍 Searchable**: JSON format enables powerful log searching and filtering
- **📊 Analyzable**: Structured data can be easily aggregated and analyzed
- **🔗 Correlatable**: Consistent schema enables correlation across services
- **🤖 Machine-readable**: Perfect for log aggregation systems and monitoring tools
- **📈 Scalable**: Efficient parsing and storage in modern logging systems

## ✨ Features

### 🚀 **Core Logging**
- **📊 Structured JSON Logging** - All logs automatically formatted as structured JSON with consistent schema
- **🔄 Functional Programming** - Pure functions with dependency injection and duck-typing
- **🚚 Multiple Transports** - Console, DataDog, Splunk, Elasticsearch, New Relic, CloudWatch, File
- **🌍 Environment-aware** - Automatic configuration based on environment variables

### 🛠️ **Developer Experience**
- **📝 TypeScript Support** - Full TypeScript support with comprehensive type definitions
- **⚡ AWS Lambda Optimized** - Designed to work seamlessly in AWS Lambda environments
- **🔧 Extensible** - Easy to add custom transports and formatters using duck-typing
- **📈 Performance Monitoring** - Built-in performance tracking and metrics

### 🔒 **Advanced Features**
- **🛡️ Comprehensive Error Handling** - Clear, actionable error messages with solutions
- **🔍 Advanced Features** - Log filtering, validation, redaction, sampling, rate limiting, enrichment, and batching
- **🔐 Security** - Built-in support for forbidden keys filtering and redaction
- **🔗 Correlation Tracking** - Distributed tracing support

## 🚀 Quick Start

### 1. Install Strogger

```bash
npm install strogger
```

### 2. Basic Usage

```typescript
import { strogger } from 'strogger';

// Simple logging
strogger.info('Application started');
strogger.debug('Processing request', { requestId: '123' });
strogger.warn('Deprecated feature used');
strogger.error('Something went wrong', { userId: '456' }, new Error('Database connection failed'));
```

### 3. Functional Approach with Dependency Injection

```typescript
import { 
  createLogger, 
  createConsoleTransport, 
  createJsonFormatter, 
  getEnvironment,
  LogLevel 
} from 'strogger';

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

## 📖 Usage Guide

### 🎯 Installation Methods

| Method | Install Command | Import Statement | Best For |
|--------|----------------|------------------|----------|
| **NPM** | `npm install strogger` | `import { strogger } from 'strogger'` | **Production projects** |
| **Yarn** | `yarn add strogger` | `import { strogger } from 'strogger'` | Yarn-based projects |
| **PNPM** | `pnpm add strogger` | `import { strogger } from 'strogger'` | PNPM-based projects |

### 🔍 API Reference

#### **Conventional vs Branded APIs**

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

#### **Core Functions**

```typescript
// Logger creation
createLogger(config)
createStrogger(config)

// Transport creation
createConsoleTransport(options)
createStroggerConsoleTransport(options)
createCloudWatchTransport(options)
createDataDogTransport(options)
createSplunkTransport(options)
createElasticsearchTransport(options)
createNewRelicTransport(options)
createFileTransport(options)

// Formatter creation
createJsonFormatter(options)

// Environment utilities
getEnvironment()
getEnvironmentVariables()
```

#### **Logging Levels**

```typescript
import { LogLevel } from 'strogger';

// Available levels
LogLevel.DEBUG   // 0
LogLevel.INFO    // 1
LogLevel.WARN    // 2
LogLevel.ERROR   // 3
LogLevel.FATAL   // 4
```

### 📦 Transport Examples

#### **Console Transport**

```typescript
import { createConsoleTransport, createJsonFormatter } from 'strogger';

const formatter = createJsonFormatter();
const transport = createConsoleTransport({ 
  formatter, 
  level: LogLevel.DEBUG,
  useColors: true 
});
```

#### **CloudWatch Transport**

```typescript
import { createCloudWatchTransport, createJsonFormatter } from 'strogger';

const formatter = createJsonFormatter();
const transport = createCloudWatchTransport({
  formatter,
  logGroupName: '/aws/lambda/my-function',
  logStreamName: 'production',
  region: 'us-east-1'
});
```

#### **DataDog Transport**

```typescript
import { createDataDogTransport, createJsonFormatter } from 'strogger';

const formatter = createJsonFormatter();
const transport = createDataDogTransport({
  formatter,
  apiKey: process.env.DATADOG_API_KEY,
  service: 'my-service',
  source: 'nodejs'
});
```

### 🎯 Convenience Methods

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
    stage: 'production',
    enableStructuredLogging: true
  },
  transports: [transport],
  formatter,
  env
});
```

## 🏷️ Third-Party Integrations

Strogger provides built-in support for popular logging and monitoring services:

### **AWS CloudWatch**
- Automatic log group and stream management
- Lambda-optimized with minimal cold start impact
- Batch logging for cost efficiency

### **DataDog**
- Structured JSON logs with automatic parsing
- Service and source tagging
- Performance metrics integration

### **Splunk**
- HEC (HTTP Event Collector) support
- Structured data with source types
- Index management and routing

### **Elasticsearch**
- Direct indexing with bulk operations
- Mapping templates for optimal search
- Cluster health monitoring

### **New Relic**
- Distributed tracing integration
- Custom attributes and metrics
- Error tracking and alerting

### **File Transport**
- Rotating log files with compression
- Size and time-based rotation
- Structured JSON output

## 🎯 Best Practices

### **1. Use Structured Logging Consistently**

```typescript
// ✅ Good - Structured data
strogger.info('User login successful', { 
  userId: '123', 
  method: 'oauth', 
  provider: 'google' 
});

// ❌ Avoid - Unstructured strings
strogger.info('User 123 logged in via Google OAuth');
```

### **2. Leverage Context for Correlation**

```typescript
const context = {
  requestId: 'req-123',
  userId: 'user-456',
  sessionId: 'sess-789'
};

strogger.info('Processing payment', context, { 
  amount: 100.50, 
  currency: 'USD' 
});
```

### **3. Use Appropriate Log Levels**

```typescript
// DEBUG - Detailed information for debugging
strogger.debug('Database query executed', { query: 'SELECT * FROM users' });

// INFO - General application flow
strogger.info('User registration completed', { userId: '123' });

// WARN - Potentially harmful situations
strogger.warn('Deprecated API endpoint called', { endpoint: '/api/v1/users' });

// ERROR - Error events that might still allow the application to continue
strogger.error('Database connection failed', { retryCount: 3 });

// FATAL - Very severe error events that will presumably lead to application failure
strogger.fatal('Application cannot start due to missing configuration');
```

### **4. Implement Proper Error Handling**

```typescript
try {
  const result = await processPayment(paymentData);
  strogger.info('Payment processed successfully', { 
    paymentId: result.id, 
    amount: paymentData.amount 
  });
} catch (error) {
  strogger.error('Payment processing failed', { 
    paymentId: paymentData.id, 
    error: error.message 
  }, error);
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### **Development Setup**

```bash
# Clone the repository
git clone https://github.com/TheLeePriest/strogger.git
cd strogger

# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint

# Build the project
npm run build
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Documentation**: [GitHub README](https://github.com/TheLeePriest/strogger#readme)
- **Issues**: [GitHub Issues](https://github.com/TheLeePriest/strogger/issues)
- **NPM Package**: [strogger on NPM](https://www.npmjs.com/package/strogger)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

---

**Made with ❤️ by the Strogger Team** 