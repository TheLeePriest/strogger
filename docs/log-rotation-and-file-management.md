# Log Rotation and File Management

This document explains log rotation and file management concepts, why they're important, and how to implement them in your logging system.

## 🎯 **What is Log Rotation?**

Log rotation is a technique that automatically manages log files to prevent them from growing indefinitely. It ensures your application doesn't run out of disk space while maintaining a history of logs for debugging and monitoring.

## 📊 **Why Log Rotation is Essential**

### **1. Disk Space Management**
- **Problem**: Log files can grow to gigabytes, filling up disk space
- **Solution**: Rotate logs when they reach a certain size
- **Benefit**: Prevents disk space issues and application crashes

### **2. Performance Optimization**
- **Problem**: Large log files are slow to read and write
- **Solution**: Keep log files at manageable sizes
- **Benefit**: Faster log operations and better application performance

### **3. Historical Data Preservation**
- **Problem**: Need to keep logs for compliance or debugging
- **Solution**: Maintain a limited number of rotated log files
- **Benefit**: Balance between storage costs and data retention

### **4. System Stability**
- **Problem**: Unbounded log growth can crash systems
- **Solution**: Automatic rotation prevents runaway log files
- **Benefit**: More stable and reliable applications

## 🔄 **Rotation Strategies**

### **1. Size-Based Rotation**
Rotate when log file reaches a specific size.

```typescript
const fileTransport = createFileTransport('./logs/app.log', {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5, // Keep 5 files
});
```

**File Pattern**: `app.log`, `app.log.1`, `app.log.2`, etc.

### **2. Time-Based Rotation**
Rotate logs at specific time intervals.

```typescript
const fileTransport = createFileTransport('./logs/app.log', {
  rotationInterval: 24 * 60 * 60 * 1000, // 24 hours
  maxFiles: 7, // Keep 7 days of logs
});
```

**File Pattern**: `app.log`, `app.2024-01-15.1.log`, `app.2024-01-14.1.log`, etc.

### **3. Hybrid Rotation**
Combine size and time limits for maximum control.

```typescript
const fileTransport = createFileTransport('./logs/app.log', {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  rotationInterval: 24 * 60 * 60 * 1000, // 24 hours
  maxFiles: 10, // Keep 10 files
});
```

## 📁 **File Naming Conventions**

### **Standard Rotation Pattern**
```
app.log          # Current log file
app.log.1        # Most recent rotated file
app.log.2        # Second most recent
app.log.3        # Third most recent
...
app.log.N        # Oldest file (gets deleted)
```

### **Date-Based Pattern**
```
app.log                    # Current log file
app.2024-01-15.1.log      # Today's rotated file
app.2024-01-14.1.log      # Yesterday's file
app.2024-01-13.1.log      # Day before yesterday
```

### **Compressed Pattern**
```
app.log                    # Current log file
app.log.1.gz              # Compressed rotated file
app.log.2.gz              # Older compressed file
```

## 🛠 **Implementation Example**

Here's how to implement log rotation in your functional logger:

```typescript
import { createLogger, createJsonFormatter, getEnvironment, LogLevel } from '@cdk-insights/logger';

// File transport with rotation
const createFileTransportWithRotation = (filePath: string, options = {}) => {
  const {
    maxFileSize = 10 * 1024 * 1024, // 10MB
    maxFiles = 5,
    rotationInterval = 24 * 60 * 60 * 1000, // 24 hours
  } = options;

  let currentSize = 0;
  let lastRotation = Date.now();

  const shouldRotate = () => {
    const timeSinceLastRotation = Date.now() - lastRotation;
    return currentSize >= maxFileSize || timeSinceLastRotation >= rotationInterval;
  };

  const rotateFiles = async () => {
    // 1. Close current file
    // 2. Rename existing files (shift them)
    // 3. Delete oldest file if needed
    // 4. Reset counters
    currentSize = 0;
    lastRotation = Date.now();
  };

  const writeToFile = async (content: string) => {
    if (shouldRotate()) {
      await rotateFiles();
    }
    
    // Write content to file
    // Update currentSize
    currentSize += content.length;
  };

  return {
    log: async (entry) => {
      const logLine = JSON.stringify(entry);
      await writeToFile(logLine);
    },
    setLevel: (level) => { /* set level */ },
    getLevel: () => LogLevel.INFO,
  };
};

// Usage
const logger = createLogger({
  config: { serviceName: 'my-app' },
  transports: [
    createFileTransportWithRotation('./logs/app.log', {
      maxFileSize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3,
      rotationInterval: 60 * 60 * 1000, // 1 hour
    })
  ],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

## ⚙️ **Configuration Options**

### **Size Limits**
```typescript
const sizeOptions = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5, // Keep 5 files
};
```

### **Time Limits**
```typescript
const timeOptions = {
  rotationInterval: 24 * 60 * 60 * 1000, // 24 hours
  maxFiles: 7, // Keep 7 days
};
```

### **Compression**
```typescript
const compressionOptions = {
  compressOldFiles: true,
  compressionLevel: 6, // 0-9, higher = smaller files
};
```

### **Advanced Options**
```typescript
const advancedOptions = {
  dateFormat: 'YYYY-MM-DD-HH', // Custom date format
  encoding: 'utf8',
  createSymlink: true, // Create symlink to current file
  symlinkName: 'current.log',
};
```

## 🔧 **Best Practices**

### **1. Choose Appropriate Limits**
```typescript
// For high-traffic applications
const highTrafficConfig = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxFiles: 10,
  rotationInterval: 60 * 60 * 1000, // 1 hour
};

// For low-traffic applications
const lowTrafficConfig = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 5,
  rotationInterval: 24 * 60 * 60 * 1000, // 24 hours
};
```

### **2. Monitor Disk Usage**
```typescript
const monitorDiskUsage = () => {
  const totalSize = calculateTotalLogSize();
  const maxAllowedSize = 1024 * 1024 * 1024; // 1GB
  
  if (totalSize > maxAllowedSize) {
    // Trigger emergency rotation or alert
    console.warn('Log directory size exceeded limit');
  }
};
```

### **3. Handle Rotation Errors**
```typescript
const safeRotate = async () => {
  try {
    await rotateFiles();
  } catch (error) {
    // Fallback: delete oldest files
    await emergencyCleanup();
    // Alert administrators
    notifyAdmins('Log rotation failed', error);
  }
};
```

### **4. Use Compression for Old Files**
```typescript
const compressOldFiles = async (filePath: string) => {
  // Compress files older than 1 day
  // Reduces disk usage by 70-90%
};
```

## 📊 **Monitoring and Metrics**

### **Key Metrics to Track**
```typescript
const logMetrics = {
  currentFileSize: 0,
  totalLogSize: 0,
  rotationCount: 0,
  lastRotationTime: 0,
  writeErrors: 0,
  rotationErrors: 0,
};
```

### **Health Checks**
```typescript
const checkLogHealth = () => {
  return {
    isHealthy: currentFileSize < maxFileSize * 0.9,
    currentSize: currentFileSize,
    lastRotation: lastRotationTime,
    errors: writeErrors + rotationErrors,
  };
};
```

## 🚀 **Integration with Your Logger**

### **Multiple Transports with Rotation**
```typescript
const logger = createLogger({
  config: { serviceName: 'multi-transport-app' },
  transports: [
    // Console for development
    createConsoleTransport({ level: LogLevel.DEBUG }),
    
    // File transport with rotation for production
    createFileTransportWithRotation('./logs/app.log', {
      maxFileSize: 10 * 1024 * 1024,
      maxFiles: 5,
      rotationInterval: 24 * 60 * 60 * 1000,
    }),
    
    // Error-only file with different rotation
    createFileTransportWithRotation('./logs/errors.log', {
      maxFileSize: 5 * 1024 * 1024,
      maxFiles: 10,
      level: LogLevel.ERROR,
    }),
  ],
  formatter: createJsonFormatter(),
  env: getEnvironment(),
});
```

### **Environment-Specific Configuration**
```typescript
const getLogConfig = (env: string) => {
  switch (env) {
    case 'production':
      return {
        maxFileSize: 50 * 1024 * 1024,
        maxFiles: 10,
        rotationInterval: 60 * 60 * 1000, // 1 hour
      };
    case 'development':
      return {
        maxFileSize: 5 * 1024 * 1024,
        maxFiles: 3,
        rotationInterval: 24 * 60 * 60 * 1000, // 24 hours
      };
    default:
      return {
        maxFileSize: 10 * 1024 * 1024,
        maxFiles: 5,
        rotationInterval: 12 * 60 * 60 * 1000, // 12 hours
      };
  }
};
```

## 🎯 **Summary**

Log rotation is essential for:
- **Disk space management** - Prevent log files from growing indefinitely
- **Performance optimization** - Keep files at manageable sizes
- **Historical preservation** - Maintain useful log history
- **System stability** - Prevent log-related crashes

Your functional logger design makes it easy to add rotation by:
- **Duck-typing** - Any object with `log()` method works
- **Dependency injection** - Pass rotation config as parameters
- **Pure functions** - Easy to test and reason about
- **Composability** - Mix with other transports

The key is choosing appropriate limits for your use case and monitoring the rotation process to ensure it's working correctly. 