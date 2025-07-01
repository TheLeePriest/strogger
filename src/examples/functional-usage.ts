// Functional Logger Usage Example: Demonstrates dependency injection, custom transport, performance monitor, and formatter duck-typing.
import {
  LogLevel,
  createConsoleTransport,
  createJsonFormatter,
  createLogger,
  createPerformanceMonitor,
  getEnvironment,
} from "../index";

// Basic functional logger with dependency injection
const env = getEnvironment();
const formatter = createJsonFormatter();
const transport = createConsoleTransport({ formatter, level: LogLevel.DEBUG });

const strogger = createLogger({
  config: { serviceName: "my-service", stage: "dev" },
  transports: [transport],
  formatter,
  env,
});

// Custom transport using duck-typing
const customTransport = {
  log: (entry: { timestamp: string; level: number; message: string }) => {
    console.log(`[CUSTOM] ${JSON.stringify(entry)}`);
  },
  setLevel: (level: LogLevel) => {
    console.log(`Setting custom transport level to ${level}`);
  },
  getLevel: () => LogLevel.INFO,
};

const loggerWithCustomTransport = createLogger({
  config: { serviceName: "service-with-custom-transport" },
  transports: [customTransport],
  formatter,
  env,
});

// Performance monitoring example
const performanceMonitor = createPerformanceMonitor();
const timedFunction = async () => {
  const timer = performanceMonitor.startTimer("myFunction");
  await new Promise((resolve) => setTimeout(resolve, 100));
  const metrics = timer({ userId: "123", operation: "data-processing" });
  console.log("Function completed:", metrics);
  return "result";
};

// Formatter duck-typing example
const simpleFormatter = {
  format: (entry: { timestamp: string; level: number; message: string }) =>
    `${entry.timestamp} [${entry.level}] ${entry.message}`,
};
const loggerWithSimpleFormatter = createLogger({
  config: { serviceName: "simple-formatter-service" },
  transports: [createConsoleTransport({ formatter: simpleFormatter })],
  formatter: simpleFormatter,
  env,
});

export {
  strogger,
  loggerWithCustomTransport,
  performanceMonitor,
  timedFunction,
  loggerWithSimpleFormatter,
};
