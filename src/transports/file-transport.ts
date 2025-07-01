import { promises as fs } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import type { Formatter, LogEntry } from "../types";
import { LogLevel } from "../types";
import {
  handleTransportError,
  validateEnvironmentVariable,
  validateTransportConfig,
} from "../utils/errors";
import { shouldLog } from "./base-transport";

const gzipAsync = promisify(gzip);

export interface FileTransportOptions {
  formatter?: Formatter;
  level?: LogLevel;
  filePath?: string;
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  rotationInterval?: number; // in milliseconds
  compressOldFiles?: boolean;
  dateFormat?: string;
  encoding?: BufferEncoding;
  createSymlink?: boolean;
  symlinkName?: string;
}

export interface FileTransportState {
  currentFile: string;
  currentSize: number;
  lastRotation: number;
  fileHandle?: fs.FileHandle | undefined;
}

export const createFileTransport = (options: FileTransportOptions = {}) => {
  const transportName = "File";

  try {
    let minLevel = options.level ?? LogLevel.INFO;
    const formatter = options.formatter || {
      format: (entry: LogEntry) => JSON.stringify(entry),
    };
    const filePath =
      options.filePath || process.env.LOG_FILE_PATH || "./logs/app.log";
    const maxFileSize = options.maxFileSize ?? 10 * 1024 * 1024; // 10MB
    const maxFiles = options.maxFiles ?? 5;
    const rotationInterval = options.rotationInterval ?? 24 * 60 * 60 * 1000; // 24 hours
    const compressOldFiles = options.compressOldFiles ?? false;
    const dateFormat = options.dateFormat ?? "YYYY-MM-DD";
    const encoding = options.encoding ?? "utf8";
    const createSymlink = options.createSymlink ?? false;
    const symlinkName = options.symlinkName ?? "current.log";

    // Validate required configuration
    validateEnvironmentVariable("LOG_FILE_PATH", filePath, false);

    // Validate transport configuration
    validateTransportConfig(transportName, { filePath }, ["filePath"]);

    const state: FileTransportState = {
      currentFile: filePath,
      currentSize: 0,
      lastRotation: Date.now(),
    };

    let flushTimer: ReturnType<typeof setInterval> | null = null;

    const ensureDirectory = async (filePath: string): Promise<void> => {
      const dir = dirname(filePath);
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    };

    const getRotatedFileName = (
      originalPath: string,
      index: number,
    ): string => {
      const ext = extname(originalPath);
      const base = originalPath.replace(ext, "");
      const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const compressedExt = compressOldFiles ? ".gz" : "";
      return `${base}.${timestamp}.${index}${ext}${compressedExt}`;
    };

    const shouldRotate = (): boolean => {
      const timeSinceLastRotation = Date.now() - state.lastRotation;
      return (
        state.currentSize >= maxFileSize ||
        timeSinceLastRotation >= rotationInterval
      );
    };

    const compressFile = async (filePath: string): Promise<void> => {
      if (!compressOldFiles) return;

      try {
        const content = await fs.readFile(filePath, encoding);
        const compressed = await gzipAsync(content);
        await fs.writeFile(`${filePath}.gz`, compressed);
        await fs.unlink(filePath); // Remove original file
      } catch (error) {
        handleTransportError(error, transportName, true);
      }
    };

    const rotateFiles = async (): Promise<void> => {
      try {
        // Close current file handle if open
        if (state.fileHandle) {
          await state.fileHandle.close();
          state.fileHandle = undefined;
        }

        // Rotate existing files
        for (let i = maxFiles - 1; i >= 1; i--) {
          const oldFile = getRotatedFileName(filePath, i);
          const newFile = getRotatedFileName(filePath, i + 1);

          try {
            await fs.access(oldFile);
            await fs.rename(oldFile, newFile);
          } catch {
            // File doesn't exist, continue
          }
        }

        // Move current file to .1
        const rotatedFile = getRotatedFileName(filePath, 1);
        try {
          await fs.access(filePath);
          await fs.rename(filePath, rotatedFile);
          await compressFile(rotatedFile);
        } catch {
          // Current file doesn't exist, that's okay
        }

        // Reset state
        state.currentSize = 0;
        state.lastRotation = Date.now();

        // Create new file
        await ensureDirectory(filePath);
        state.fileHandle = await fs.open(filePath, "a");

        // Create symlink if requested
        if (createSymlink) {
          const symlinkPath = join(dirname(filePath), symlinkName);
          try {
            await fs.unlink(symlinkPath);
          } catch {
            // Symlink doesn't exist, that's okay
          }
          await fs.symlink(basename(filePath), symlinkPath);
        }

        console.log(`[FILE] Rotated log file to: ${rotatedFile}`);
      } catch (error) {
        handleTransportError(error, transportName, true);
      }
    };

    const writeToFile = async (content: string): Promise<void> => {
      try {
        // Check if rotation is needed
        if (shouldRotate()) {
          await rotateFiles();
        }

        // Ensure file handle is open
        if (!state.fileHandle) {
          await ensureDirectory(filePath);
          state.fileHandle = await fs.open(filePath, "a");
        }

        // Write content
        const logLine = `${content}\n`;
        await state.fileHandle.write(logLine, undefined, encoding);
        state.currentSize += logLine.length;
      } catch (error) {
        handleTransportError(error, transportName, true);
      }
    };

    const flush = async (): Promise<void> => {
      try {
        if (state.fileHandle) {
          await state.fileHandle.sync();
        }
      } catch (error) {
        handleTransportError(error, transportName, true);
      }
    };

    const startFlushTimer = () => {
      if (flushTimer) return;

      flushTimer = setInterval(() => {
        flush().catch((error) => {
          handleTransportError(error, transportName, true);
        });
      }, 5000); // Flush every 5 seconds
    };

    // Start the flush timer
    startFlushTimer();

    return {
      log: async (entry: LogEntry) => {
        if (!shouldLog(entry.level, minLevel)) return;

        const formattedMessage = formatter.format(entry);
        await writeToFile(formattedMessage);
      },

      setLevel: (level: LogLevel) => {
        minLevel = level;
      },

      getLevel: () => minLevel,

      // File transport specific methods
      rotate: async () => {
        await rotateFiles();
      },

      getCurrentFile: () => state.currentFile,

      getCurrentSize: () => state.currentSize,

      flush: async () => {
        await flush();
      },

      close: async () => {
        if (flushTimer) {
          clearInterval(flushTimer);
          flushTimer = null;
        }

        if (state.fileHandle) {
          await state.fileHandle.close();
          state.fileHandle = undefined;
        }
      },

      // Get current configuration
      getConfig: () => ({
        filePath,
        maxFileSize,
        maxFiles,
        rotationInterval,
        compressOldFiles,
        dateFormat,
        encoding,
        createSymlink,
        symlinkName,
      }),

      // Get transport statistics
      getStats: () => ({
        currentFile: state.currentFile,
        currentSize: state.currentSize,
        lastRotation: state.lastRotation,
        fileHandleOpen: !!state.fileHandle,
        flushTimerActive: !!flushTimer,
      }),
    };
  } catch (error) {
    handleTransportError(error, transportName, false);
    throw error; // Re-throw for proper error handling
  }
};
