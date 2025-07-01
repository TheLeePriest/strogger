import {
  LogLevel,
  createJsonFormatter,
  createLogger,
  getEnvironment,
} from "../index";

// File Transport Example: Demonstrates a mock file transport with log rotation logic (no real file I/O).

// Mock file transport with rotation logic
export const createFileTransportExample = (
  options: {
    level?: LogLevel;
    maxFileSize?: number;
    rotationInterval?: number;
  } = {},
) => {
  let minLevel = options.level ?? LogLevel.INFO;
  const maxFileSize = options.maxFileSize ?? 10 * 1024 * 1024;
  const rotationInterval = options.rotationInterval ?? 24 * 60 * 60 * 1000;
  let currentSize = 0;
  let lastRotation = Date.now();

  const shouldRotate = () =>
    currentSize >= maxFileSize || Date.now() - lastRotation >= rotationInterval;

  const rotate = async () => {
    currentSize = 0;
    lastRotation = Date.now();
    console.log("[MOCK FILE] Rotated log file");
  };

  const writeToFile = async (content: string) => {
    if (shouldRotate()) await rotate();
    currentSize += content.length;
    console.log(`[MOCK FILE] Writing: ${content}`);
  };

  return {
    log: async (entry: {
      level: number;
      timestamp: string;
      message: string;
    }) => {
      if (entry.level < minLevel) return;
      const logLine = JSON.stringify(entry);
      await writeToFile(logLine);
    },
    setLevel: (level: LogLevel) => {
      minLevel = level;
    },
    getLevel: () => minLevel,
  };
};

// Minimal logger usage with mock file transport
const env = getEnvironment();
const formatter = createJsonFormatter();
const fileTransport = createFileTransportExample({
  maxFileSize: 1024, // 1KB for demo
  rotationInterval: 10000, // 10s for demo
});

export const stroggerWithFileTransport = createLogger({
  config: { serviceName: "file-rotation-example" },
  transports: [fileTransport],
  formatter,
  env,
});
