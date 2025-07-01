# Third-Party Integration Guide

The `@cdk-insights/logger` library is designed with maximum flexibility to integrate with any third-party logging system. Thanks to the functional approach and duck-typing, adding new transports is incredibly simple.

## 🎯 Why It's So Easy

### **Duck-Typing**
Any object with a `log(entry)` method can be a transport. No inheritance required!

### **Functional Approach**
Pure functions with dependency injection make testing and customization easy.

### **Structured Data**
All logs are already in structured JSON format, perfect for any logging system.

### **Built-in Transports**
The library comes with pre-built transports for popular logging services.

## 📡 Built-in Transports

### **DataDog Integration**

DataDog is a popular monitoring and analytics platform. The logger provides a built-in DataDog transport with batching and error handling.

```typescript
import { 
  createLogger, 
  createDataDogTransport, 
  createJsonFormatter, 
  getEnvironment,
  LogLevel 
} from '@cdk-insights/logger';

const env = getEnvironment();

const dataDogTransport = createDataDogTransport({
  level: LogLevel.INFO,
  apiKey: process.env.DATADOG_API_KEY,
  serviceName: 'my-service',
  source: 'nodejs',
  tags: ['env:prod', 'team:backend'],
  batchSize: 10,
  flushInterval: 5000,
  region: 'us' // or 'eu'
});

const logger = createLogger({
  config: { serviceName: 'my-service' },
  transports: [dataDogTransport],
  formatter: createJsonFormatter(),
  env,
});
```

**Environment Variables:**
```bash
DATADOG_API_KEY=your-datadog-api-key
DD_SERVICE=my-service
DD_SITE=us  # or eu
```

**Features:**
- Automatic batching for better performance
- Built-in error handling and retry logic
- Support for custom tags and metadata
- Region-specific endpoints (US/EU)
- Rate limiting and backoff strategies

### **Splunk Integration**

Splunk is a powerful log analysis platform. The logger provides a Splunk HEC (HTTP Event Collector) transport.

```typescript
import { 
  createLogger, 
  createSplunkTransport, 
  createJsonFormatter, 
  getEnvironment,
  LogLevel 
} from '@cdk-insights/logger';

const env = getEnvironment();

const splunkTransport = createSplunkTransport({
  level: LogLevel.INFO,
  hecUrl: process.env.SPLUNK_HEC_URL,
  hecToken: process.env.SPLUNK_HEC_TOKEN,
  source: 'my-service',
  sourcetype: '_json',
  index: 'my-logs',
  channel: 'my-channel',
  batchSize: 10,
  flushInterval: 5000
});

const logger = createLogger({
  config: { serviceName: 'my-service' },
  transports: [splunkTransport],
  formatter: createJsonFormatter(),
  env,
});
```

**Environment Variables:**
```bash
SPLUNK_HEC_URL=https://your-splunk-instance:8088/services/collector
SPLUNK_HEC_TOKEN=your-splunk-hec-token
SPLUNK_INDEX=my-logs
SPLUNK_CHANNEL=my-channel
```

**Features:**
- HEC (HTTP Event Collector) support
- Automatic batching and flushing
- Custom source, sourcetype, and index configuration
- Channel support for load balancing
- Comprehensive error handling

### **Elasticsearch Integration**

Elasticsearch is a distributed search and analytics engine. The logger provides an Elasticsearch transport with bulk indexing.

```typescript
import { 
  createLogger, 
  createElasticsearchTransport, 
  createJsonFormatter, 
  getEnvironment,
  LogLevel 
} from '@cdk-insights/logger';

const env = getEnvironment();

const elasticsearchTransport = createElasticsearchTransport({
  level: LogLevel.INFO,
  url: process.env.ELASTICSEARCH_URL,
  apiKey: process.env.ELASTICSEARCH_API_KEY,
  // Or use username/password:
  // username: process.env.ELASTICSEARCH_USERNAME,
  // password: process.env.ELASTICSEARCH_PASSWORD,
  index: 'logs',
  indexPattern: 'logs-{YYYY.MM.DD}',
  batchSize: 10,
  flushInterval: 5000,
  timeout: 30000
});

const logger = createLogger({
  config: { serviceName: 'my-service' },
  transports: [elasticsearchTransport],
  formatter: createJsonFormatter(),
  env,
});
```

**Environment Variables:**
```bash
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_API_KEY=your-elasticsearch-api-key
# Or use username/password:
# ELASTICSEARCH_USERNAME=your-username
# ELASTICSEARCH_PASSWORD=your-password
ELASTICSEARCH_INDEX=logs
ELASTICSEARCH_INDEX_PATTERN=logs-{YYYY.MM.DD}
```

**Features:**
- Bulk indexing for better performance
- Support for both API key and username/password authentication
- Dynamic index naming with date patterns
- Automatic error handling and retry logic
- Configurable timeouts and batch sizes

### **New Relic Integration**

New Relic is a performance monitoring platform. The logger provides a New Relic transport for log forwarding.

```typescript
import { 
  createLogger, 
  createNewRelicTransport, 
  createJsonFormatter, 
  getEnvironment,
  LogLevel 
} from '@cdk-insights/logger';

const env = getEnvironment();

const newRelicTransport = createNewRelicTransport({
  level: LogLevel.INFO,
  apiKey: process.env.NEW_RELIC_LICENSE_KEY,
  accountId: process.env.NEW_RELIC_ACCOUNT_ID,
  serviceName: 'my-service',
  region: 'us', // or 'eu'
  batchSize: 10,
  flushInterval: 5000
});

const logger = createLogger({
  config: { serviceName: 'my-service' },
  transports: [newRelicTransport],
  formatter: createJsonFormatter(),
  env,
});
```

**Environment Variables:**
```bash
NEW_RELIC_LICENSE_KEY=your-newrelic-license-key
NEW_RELIC_ACCOUNT_ID=your-newrelic-account-id
```

**Features:**
- New Relic Logs API integration
- Automatic batching and flushing
- Support for US and EU regions
- Built-in error handling and retry logic
- Service name and metadata support

## 🔧 Advanced Integration Patterns

### **Multiple Transports with Different Levels**

```typescript
import { 
  createLogger, 
  createConsoleTransport,
  createDataDogTransport,
  createSplunkTransport,
  createNewRelicTransport,
  getEnvironment,
  LogLevel 
} from '@cdk-insights/logger';

const env = getEnvironment();
const formatter = createJsonFormatter();

const logger = createLogger({
  config: { serviceName: 'multi-transport-service' },
  transports: [
    // Console for all levels in development
    createConsoleTransport({ formatter, level: LogLevel.DEBUG }),
    
    // DataDog for INFO and above in production
    ...(env.isProduction ? [
      createDataDogTransport({ 
        level: LogLevel.INFO,
        tags: ['env:prod', 'team:backend']
      })
    ] : []),
    
    // Splunk for ERROR and above
    createSplunkTransport({ 
      level: LogLevel.ERROR,
      index: 'error-logs'
    }),
    
    // New Relic for FATAL only
    createNewRelicTransport({ 
      level: LogLevel.FATAL,
      serviceName: 'critical-service'
    }),
  ],
  formatter,
  env,
});
```

### **Custom Webhook Transport**

```typescript
const createWebhookTransport = (webhookUrl: string, options = {}) => {
  let minLevel = options.level ?? LogLevel.INFO;
  
  return {
    log: async (entry) => {
      if (entry.level < minLevel) return;
      
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          body: JSON.stringify({
            timestamp: entry.timestamp,
            level: entry.level,
            message: entry.message,
            context: entry.context,
            metadata: entry.metadata,
            ...(options.transform?.(entry) || {}),
          }),
        });
      } catch (error) {
        console.error('Webhook transport failed:', error);
      }
    },
    setLevel: (level) => { minLevel = level; },
    getLevel: () => minLevel,
  };
};

// Usage
const webhookTransport = createWebhookTransport('https://alerts.company.com/webhook', {
  level: LogLevel.FATAL,
  headers: { 'X-API-Key': process.env.ALERT_WEBHOOK_KEY },
  transform: (entry) => ({ 
    alert: true, 
    priority: 'high',
    team: 'oncall'
  })
});
```

### **Customer-Specific Transport**

```typescript
const createCustomerSpecificTransport = (customerConfig) => {
  let minLevel = customerConfig.level ?? LogLevel.INFO;
  
  return {
    log: async (entry) => {
      if (entry.level < minLevel) return;
      
      // Customer can define their own logic here
      const transformedEntry = customerConfig.transform?.(entry) || entry;
      
      // Send to customer's preferred destination
      if (customerConfig.destination === 'newrelic') {
        // New Relic logic
        await fetch('https://log-api.newrelic.com/log/v1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Key': customerConfig.apiKey,
          },
          body: JSON.stringify(transformedEntry),
        });
      } else if (customerConfig.destination === 'datadog') {
        // DataDog logic
        await fetch('https://http-intake.logs.datadoghq.com/api/v2/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': customerConfig.apiKey,
          },
          body: JSON.stringify(transformedEntry),
        });
      } else if (customerConfig.destination === 'custom') {
        // Custom webhook
        if (customerConfig.webhookUrl) {
          await fetch(customerConfig.webhookUrl, {
            method: 'POST',
            headers: customerConfig.headers || {},
            body: JSON.stringify(transformedEntry),
          });
        }
      }
    },
    setLevel: (level) => { minLevel = level; },
    getLevel: () => minLevel,
  };
};
```

### **Conditional Transport Based on Environment**

```typescript
const createConditionalTransport = (conditions) => {
  let minLevel = conditions.level ?? LogLevel.INFO;
  
  return {
    log: async (entry) => {
      if (entry.level < minLevel) return;
      
      // Only log if conditions are met
      if (conditions.onlyInProduction && !env.isProduction) return;
      if (conditions.onlyForErrors && entry.level < LogLevel.ERROR) return;
      if (conditions.onlyForService && entry.context?.serviceName !== conditions.onlyForService) return;
      
      // Execute the actual transport logic
      await conditions.transport.log(entry);
    },
    setLevel: (level) => { minLevel = level; },
    getLevel: () => minLevel,
  };
};

// Usage
const conditionalDataDog = createConditionalTransport({
  level: LogLevel.INFO,
  onlyInProduction: true,
  onlyForErrors: false,
  onlyForService: 'payment-service',
  transport: createDataDogTransport({ level: LogLevel.INFO })
});
```

## 🚀 Performance Optimizations

### **Batching**

All built-in transports support batching for better performance:

```typescript
const dataDogTransport = createDataDogTransport({
  batchSize: 50,        // Send logs in batches of 50
  flushInterval: 2000,  // Flush every 2 seconds
  // ... other options
});
```

### **Rate Limiting**

```typescript
const logger = createLogger({
  config: {
    serviceName: 'rate-limited-service',
    rateLimit: {
      maxLogsPerSecond: 100,
      burstSize: 50
    }
  },
  // ... other config
});
```

### **Sampling**

```typescript
const logger = createLogger({
  config: {
    serviceName: 'sampled-service',
    samplingRate: 0.1  // Only log 10% of entries
  },
  // ... other config
});
```

## 🛡️ Error Handling

All transports include comprehensive error handling:

```typescript
// Transports automatically handle errors and provide fallbacks
const dataDogTransport = createDataDogTransport({
  // ... config
});

// You can also handle errors manually
try {
  await dataDogTransport.flush();
} catch (error) {
  console.error('DataDog flush failed:', error);
  // Implement your own fallback logic
}
```

## 📊 Monitoring and Metrics

### **Transport Statistics**

```typescript
// Get transport statistics
const stats = dataDogTransport.getStats();
console.log('DataDog transport stats:', stats);
// {
//   totalLogs: 1234,
//   totalBatches: 25,
//   averageBatchSize: 49.36,
//   lastFlushTime: 1642234567890,
//   pendingLogs: 5
// }
```

### **Health Checks**

```typescript
// Check transport health
const isHealthy = await dataDogTransport.healthCheck();
if (!isHealthy) {
  console.warn('DataDog transport is unhealthy');
}
```

## 🔧 Configuration Best Practices

### **Environment-Specific Configuration**

```typescript
const getTransportConfig = (env) => {
  const baseConfig = {
    level: LogLevel.INFO,
    batchSize: 10,
    flushInterval: 5000
  };
  
  if (env.isProduction) {
    return {
      ...baseConfig,
      batchSize: 50,
      flushInterval: 2000,
      tags: ['env:prod']
    };
  }
  
  if (env.isDevelopment) {
    return {
      ...baseConfig,
      batchSize: 5,
      flushInterval: 1000,
      tags: ['env:dev']
    };
  }
  
  return baseConfig;
};
```

### **Service-Specific Configuration**

```typescript
const getServiceTransports = (serviceName, env) => {
  const transports = [
    createConsoleTransport({ level: LogLevel.DEBUG })
  ];
  
  // Add service-specific transports
  switch (serviceName) {
    case 'payment-service':
      transports.push(
        createDataDogTransport({
          level: LogLevel.INFO,
          tags: ['service:payment', 'critical:true']
        })
      );
      break;
      
    case 'user-service':
      transports.push(
        createSplunkTransport({
          level: LogLevel.INFO,
          index: 'user-logs'
        })
      );
      break;
      
    case 'analytics-service':
      transports.push(
        createElasticsearchTransport({
          level: LogLevel.INFO,
          index: 'analytics-logs'
        })
      );
      break;
  }
  
  return transports;
};
```

## 📚 Additional Resources

- [Advanced Features Guide](./advanced-features.md) - Learn about filtering, validation, redaction, and more
- [Error Handling Guide](./error-handling.md) - Comprehensive error handling strategies
- [Performance Monitoring](./advanced-features.md#performance-monitoring) - Built-in performance tracking
- [Log Sampling and Rate Limiting](./advanced-features.md#log-sampling) - Control log volume and performance

## 🤝 Contributing New Transports

Creating a new transport is simple thanks to duck-typing:

```typescript
const createCustomTransport = (options = {}) => {
  let minLevel = options.level ?? LogLevel.INFO;
  
  return {
    log: async (entry) => {
      if (entry.level < minLevel) return;
      
      // Your custom logging logic here
      await sendToCustomService(entry);
    },
    setLevel: (level) => { minLevel = level; },
    getLevel: () => minLevel,
    // Optional: Add custom methods
    flush: async () => { /* flush logic */ },
    close: async () => { /* cleanup logic */ },
  };
};
```

That's it! Your custom transport will work seamlessly with the logger. 