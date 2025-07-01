# CloudWatch Log Rotation Guide

This document explains how log rotation works with AWS CloudWatch and how to implement it with your functional logger.

## 🎯 **How CloudWatch Log Rotation Works**

### **CloudWatch Architecture**

**Log Groups** → **Log Streams** → **Log Events**

```
/aws/lambda/my-function (Log Group)
├── 2024-01-15-10-30-00 (Log Stream 1)
├── 2024-01-15-11-30-00 (Log Stream 2)
├── 2024-01-15-12-30-00 (Log Stream 3)
└── 2024-01-15-13-30-00 (Log Stream 4)
```

### **Automatic Rotation Triggers**

CloudWatch automatically rotates log streams when:

1. **Size Limit**: Stream reaches 50MB
2. **Time Limit**: Stream is older than 24 hours
3. **Manual Rotation**: When you create a new stream

### **Key Differences from File Rotation**

| Aspect | File Rotation | CloudWatch Rotation |
|--------|---------------|-------------------|
| **Unit** | Files | Log Streams |
| **Size Limit** | Configurable | 50MB fixed |
| **Time Limit** | Configurable | 24 hours fixed |
| **Naming** | `app.log.1`, `app.log.2` | `2024-01-15-10-30-00` |
| **Storage** | Local disk | AWS managed |
| **Retention** | Manual cleanup | Configurable retention |

## 🛠 **Implementation Strategy**

### **1. Stream Naming Convention**

```typescript
// Time-based stream names (recommended)
const streamName = `${new Date().toISOString().split('T')[0]}-${Date.now()}`;
// Result: "2024-01-15-1705312345678"

// Function-based stream names
const streamName = `${functionName}-${Date.now()}`;
// Result: "processPayment-1705312345678"

// Hybrid approach
const streamName = `${functionName}-${new Date().toISOString().split('T')[0]}-${Date.now()}`;
// Result: "processPayment-2024-01-15-1705312345678"
```

### **2. Rotation Detection**

```typescript
const shouldRotateStream = (state: CloudWatchState): boolean => {
  const timeSinceStart = Date.now() - state.streamStartTime;
  const sizeLimit = 45 * 1024 * 1024; // 45MB (leave buffer)
  const timeLimit = 23 * 60 * 60 * 1000; // 23 hours (leave buffer)
  
  return state.currentStreamSize >= sizeLimit || timeSinceStart >= timeLimit;
};
```

### **3. Stream Rotation Process**

```typescript
const rotateStream = async (state: CloudWatchState): Promise<void> => {
  // 1. Flush current batch
  await flushBatch(state);
  
  // 2. Create new stream name
  state.currentStreamName = generateStreamName();
  
  // 3. Reset state
  state.currentStreamSize = 0;
  state.streamStartTime = Date.now();
  state.sequenceToken = undefined;
  
  // 4. Create new stream in CloudWatch
  await createLogStream(state.currentStreamName);
};
```

## 📡 **CloudWatch Transport Implementation**

Here's how to implement a CloudWatch transport with rotation:

```typescript
import { createLogger, LogLevel } from '@cdk-insights/logger';

// CloudWatch transport with rotation
const createCloudWatchTransport = (options = {}) => {
  const {
    logGroupName = '/aws/lambda/my-function',
    region = 'us-east-1',
    maxStreamSize = 45 * 1024 * 1024, // 45MB
    maxStreamAge = 23 * 60 * 60 * 1000, // 23 hours
    batchSize = 10,
    flushInterval = 5000,
  } = options;

  let state = {
    currentStreamName: `${new Date().toISOString().split('T')[0]}-${Date.now()}`,
    currentStreamSize: 0,
    streamStartTime: Date.now(),
    sequenceToken: undefined,
    batch: [],
  };

  const shouldRotateStream = () => {
    const timeSinceStart = Date.now() - state.streamStartTime;
    return state.currentStreamSize >= maxStreamSize || timeSinceStart >= maxStreamAge;
  };

  const rotateStream = async () => {
    // Flush current batch
    await flushBatch();
    
    // Create new stream
    state.currentStreamName = `${new Date().toISOString().split('T')[0]}-${Date.now()}`;
    state.currentStreamSize = 0;
    state.streamStartTime = Date.now();
    state.sequenceToken = undefined;
    
    console.log(`[CLOUDWATCH] Rotated to: ${state.currentStreamName}`);
  };

  const sendToCloudWatch = async (entries) => {
    try {
      // AWS SDK v3 import
      const { CloudWatchLogsClient, PutLogEventsCommand } = await import('@aws-sdk/client-cloudwatch-logs');
      
      const client = new CloudWatchLogsClient({ region });
      
      const logEvents = entries.map(entry => ({
        timestamp: new Date(entry.timestamp).getTime(),
        message: JSON.stringify(entry),
      }));

      const command = new PutLogEventsCommand({
        logGroupName,
        logStreamName: state.currentStreamName,
        logEvents,
        sequenceToken: state.sequenceToken,
      });

      const response = await client.send(command);
      
      // Update sequence token
      if (response.nextSequenceToken) {
        state.sequenceToken = response.nextSequenceToken;
      }

      // Update size (approximate)
      const batchSize = logEvents.reduce((sum, event) => sum + event.message.length, 0);
      state.currentStreamSize += batchSize;

    } catch (error) {
      // Handle sequence token errors
      if (error.name === 'InvalidSequenceTokenException') {
        state.sequenceToken = error.message.match(/sequenceToken is: (.+)/)?.[1];
        await sendToCloudWatch(entries); // Retry
        return;
      }
      
      console.error('CloudWatch transport failed:', error);
    }
  };

  const flushBatch = async () => {
    if (state.batch.length === 0) return;
    
    const entriesToSend = [...state.batch];
    state.batch = [];
    
    await sendToCloudWatch(entriesToSend);
  };

  // Start flush timer
  const flushTimer = setInterval(flushBatch, flushInterval);

  return {
    log: async (entry) => {
      // Check if rotation is needed
      if (shouldRotateStream()) {
        await rotateStream();
      }

      // Add to batch
      state.batch.push(entry);

      // Flush if batch is full
      if (state.batch.length >= batchSize) {
        await flushBatch();
      }
    },

    setLevel: (level) => { /* set level */ },
    getLevel: () => LogLevel.INFO,

    // CloudWatch specific methods
    rotateStream: async () => await rotateStream(),
    getCurrentStream: () => state.currentStreamName,
    getCurrentStreamSize: () => state.currentStreamSize,
    flush: async () => await flushBatch(),
    close: async () => {
      clearInterval(flushTimer);
      await flushBatch();
    },
  };
};
```

## 🚀 **Usage Examples**

### **Basic CloudWatch Logger**

```typescript
import { createLogger, createJsonFormatter, getEnvironment } from '@cdk-insights/logger';

const env = getEnvironment();
const formatter = createJsonFormatter();

const cloudWatchTransport = createCloudWatchTransport({
  logGroupName: '/aws/lambda/my-function',
  region: 'us-east-1',
  maxStreamSize: 40 * 1024 * 1024, // 40MB
  maxStreamAge: 22 * 60 * 60 * 1000, // 22 hours
});

const logger = createLogger({
  config: { serviceName: 'my-lambda-function' },
  transports: [cloudWatchTransport],
  formatter,
  env,
});

// Use the logger
logger.info('Function started', { requestId: 'req-123' });
```

### **Multiple Transports with CloudWatch**

```typescript
const logger = createLogger({
  config: { serviceName: 'multi-transport-app' },
  transports: [
    // Console for development
    createConsoleTransport({ level: LogLevel.DEBUG }),
    
    // CloudWatch for production
    ...(env.isProduction ? [
      createCloudWatchTransport({
        logGroupName: '/aws/lambda/production-app',
        maxStreamSize: 45 * 1024 * 1024,
        maxStreamAge: 23 * 60 * 60 * 1000,
      })
    ] : []),
    
    // Error-only CloudWatch stream
    createCloudWatchTransport({
      logGroupName: '/aws/lambda/errors',
      level: LogLevel.ERROR,
      maxStreamSize: 10 * 1024 * 1024, // Smaller for errors
    }),
  ],
  formatter: createJsonFormatter(),
  env,
});
```

### **Lambda-Specific Configuration**

```typescript
// For AWS Lambda functions
const createLambdaCloudWatchTransport = (functionName: string) => {
  return createCloudWatchTransport({
    logGroupName: `/aws/lambda/${functionName}`,
    logStreamName: `${functionName}-${Date.now()}`,
    maxStreamSize: 40 * 1024 * 1024, // Conservative for Lambda
    maxStreamAge: 20 * 60 * 60 * 1000, // Conservative for Lambda
    batchSize: 5, // Smaller batches for Lambda
    flushInterval: 2000, // More frequent flushing
  });
};

const lambdaLogger = createLogger({
  config: { serviceName: 'my-lambda' },
  transports: [createLambdaCloudWatchTransport('my-lambda')],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

## ⚙️ **Configuration Options**

### **Size-Based Rotation**

```typescript
const sizeBasedConfig = {
  maxStreamSize: 45 * 1024 * 1024, // 45MB (leave 5MB buffer)
  maxStreamAge: 24 * 60 * 60 * 1000, // 24 hours (let CloudWatch handle time)
};
```

### **Time-Based Rotation**

```typescript
const timeBasedConfig = {
  maxStreamSize: 50 * 1024 * 1024, // 50MB (let CloudWatch handle size)
  maxStreamAge: 12 * 60 * 60 * 1000, // 12 hours (manual rotation)
};
```

### **Conservative Configuration**

```typescript
const conservativeConfig = {
  maxStreamSize: 40 * 1024 * 1024, // 40MB (10MB buffer)
  maxStreamAge: 20 * 60 * 60 * 1000, // 20 hours (4 hour buffer)
  batchSize: 5, // Smaller batches
  flushInterval: 2000, // More frequent flushing
};
```

## 🔧 **Best Practices**

### **1. Leave Buffers**

```typescript
// Don't use exact CloudWatch limits
const goodConfig = {
  maxStreamSize: 45 * 1024 * 1024, // Not 50MB
  maxStreamAge: 23 * 60 * 60 * 1000, // Not 24 hours
};
```

### **2. Handle Sequence Tokens**

```typescript
const handleSequenceToken = (error) => {
  if (error.name === 'InvalidSequenceTokenException') {
    // Extract new token and retry
    const newToken = error.message.match(/sequenceToken is: (.+)/)?.[1];
    state.sequenceToken = newToken;
    return retryRequest();
  }
};
```

### **3. Batch Efficiently**

```typescript
const efficientBatching = {
  batchSize: 10, // Not too small, not too large
  flushInterval: 5000, // Balance between latency and efficiency
};
```

### **4. Monitor Stream Health**

```typescript
const monitorStreamHealth = () => {
  return {
    currentStream: state.currentStreamName,
    currentSize: state.currentStreamSize,
    streamAge: Date.now() - state.streamStartTime,
    batchSize: state.batch.length,
    isHealthy: state.currentStreamSize < maxStreamSize * 0.8,
  };
};
```

## 🎯 **Key Benefits**

### **Automatic Management**
- CloudWatch handles stream lifecycle
- No manual cleanup required
- Built-in retention policies

### **Scalability**
- Handles high-volume logging
- Automatic partitioning
- No local storage concerns

### **Integration**
- Native AWS service integration
- Lambda function logs automatically
- CloudWatch Insights for querying

### **Cost Optimization**
- Pay only for what you use
- Configurable retention
- No storage management overhead

## 📊 **Monitoring and Metrics**

### **CloudWatch Metrics to Track**

```typescript
const cloudWatchMetrics = {
  streamCount: 0,
  rotationCount: 0,
  batchFlushCount: 0,
  errorCount: 0,
  averageBatchSize: 0,
  streamAge: 0,
};
```

### **Health Checks**

```typescript
const checkCloudWatchHealth = () => {
  return {
    isHealthy: state.currentStreamSize < maxStreamSize * 0.8,
    currentStream: state.currentStreamName,
    streamSize: state.currentStreamSize,
    streamAge: Date.now() - state.streamStartTime,
    batchSize: state.batch.length,
    lastFlush: state.lastFlushTime,
  };
};
```

## 🎯 **Summary**

CloudWatch log rotation provides:

- **Automatic stream management** based on size and time
- **Built-in AWS integration** for Lambda and other services
- **Scalable architecture** that handles high-volume logging
- **Cost-effective storage** with configurable retention
- **Native monitoring** through CloudWatch Insights

Your functional logger's duck-typing makes it easy to add CloudWatch rotation by simply creating a transport object that handles stream rotation logic. The key is understanding CloudWatch's constraints (50MB, 24 hours) and implementing proper rotation detection and stream management. 