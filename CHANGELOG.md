# Changelog

All notable changes to the `strogger` library will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.2] - 2025-02-01

### Added

- **Request logging middleware**: `createRequestLogger()`, `createTimingMiddleware()`, and `attachLogger()` for Express/Fastify/Koa
- **Default redaction**: `createRedactor()` with sensible defaults for sensitive data (passwords, API keys, credit cards, emails, JWTs)
- **Graceful degradation**: AsyncLocalStorage now falls back gracefully in environments without `async_hooks` (e.g., browsers)
- **Enhanced error serialization**: Errors now include `code`, `statusCode`, and `cause` chain when present

### Fixed

- AsyncLocalStorage import now uses dynamic require for browser compatibility

## [3.0.1] - 2025-02-01

### Fixed

- Add missing `LogLevel` import in README log level configuration example
- Document default `strogger` export in Quick Start section

## [3.0.0] - 2025-02-01

### Breaking Changes

- **Removed branded exports**: `createStrogger`, `createStroggerConsoleTransport`, and other branded aliases have been removed. Use `createLogger` and `createConsoleTransport` instead.
- **Simplified API**: The `formatter` and `env` parameters in `createLogger` are now optional with sensible defaults.
- **Correlation IDs are now per-request**: Correlation IDs are generated fresh for each log unless you use `child()` or `runWithContext()` to share them.

### Added

- **`logger()` function**: New simplified logger creation - `logger({ serviceName: 'my-app' })` just works with sensible defaults.
- **Child loggers**: `logger.child({ requestId, userId })` creates a scoped logger that includes context in all logs.
- **AsyncLocalStorage context**: `runWithContext()` and `runWithContextAsync()` for automatic context propagation through async calls.
- **Pretty printing**: `createPrettyFormatter()` for human-readable colored output in development.
- **Context utilities**: `getContext()`, `setContext()`, `generateRequestContext()`, `withRequestContext()` for request tracing.
- **`Logger` interface**: Proper TypeScript interface for the logger return type.
- **`SerializedError` type**: Proper typing for serialized errors in logs.
- **`SimpleLoggerOptions`**: Simplified options type for the new `logger()` function.
- **`shutdown()` method**: Gracefully shutdown the logger, flushing all pending logs.
- **`onError` config option**: Custom error handler for transport failures.

### Fixed

- **Memory leak in performance monitor**: Added `maxEntriesPerFunction` limit and TTL-based eviction.
- **Batch retry reorders logs**: Fixed retry queue to maintain log order.
- **CloudWatch infinite recursion**: Added retry limit for sequence token errors.
- **CloudWatch client creation**: Client is now reused instead of created per request.
- **Hardcoded CloudWatch log group**: Now throws an error if not provided instead of using a placeholder.

### Changed

- **Auto-detection of pretty vs JSON**: Uses pretty printing in development (`STAGE !== 'prod'`), JSON in production.
- **Simplified README**: Focused on common use cases with clear examples for request tracing.
- **GitHub Actions workflow**: Now triggers on push to main with version change detection.

### Removed

- `createStrogger` (use `createLogger`)
- `createStroggerConsoleTransport` (use `createConsoleTransport`)
- `createStroggerDataDogTransport` (use `createDataDogTransport`)
- `createStroggerSplunkTransport` (use `createSplunkTransport`)
- `createStroggerElasticsearchTransport` (use `createElasticsearchTransport`)
- `createStroggerNewRelicTransport` (use `createNewRelicTransport`)
- `createStroggerCloudWatchTransport` (use `createCloudWatchTransport`)
- Example exports from public API (moved to internal)

## [2.0.3] - 2025-01-15

### Fixed

- Convert vitest config to CommonJS to resolve ES module compatibility issue

## [2.0.2] - 2025-01-14

### Changed

- Improve environment variable handling and documentation

## [2.0.1] - 2025-01-13

### Fixed

- TypeScript build error fixes

## [2.0.0] - 2025-01-12

### Added

- Bumper-cli integration for version management
- GitHub Actions workflow for automated releases

## [1.0.0] - 2024-01-15

### Added

- Initial release of `strogger`
- **Structured JSON logging** as the core feature
- Functional programming approach with dependency injection
- Duck-typing for maximum extensibility
- Multiple transport support (Console, CloudWatch, DataDog, Splunk, Elasticsearch, New Relic, File)
- Advanced logging features (filtering, validation, redaction, sampling, rate limiting)
- Performance monitoring with built-in timing and metrics collection
- Correlation tracking for distributed tracing
- Comprehensive error handling with clear, actionable error messages
- AWS Lambda optimization with CloudWatch integration
- TypeScript-first design with strict typing
- Environment-aware configuration
- Security features with forbidden keys filtering and redaction
