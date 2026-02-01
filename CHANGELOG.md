# Changelog

All notable changes to the `strogger` library will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [Unreleased]

### Added

- Initial release of structured logging library
- **Core structured JSON logging** - All logs output in structured JSON format for easy parsing and analysis
- **Functional programming approach** with dependency injection and duck-typing
- **Multiple transport support**: Console, DataDog, Splunk, Elasticsearch, New Relic, CloudWatch, File
- **Advanced features**: Log filtering, validation, redaction, sampling, rate limiting, enrichment, batching
- **Performance monitoring** with built-in timing and metrics collection
- **Correlation tracking** for distributed tracing
- **Comprehensive error handling** with clear, actionable error messages
- **AWS Lambda optimization** with CloudWatch integration
- **TypeScript-first design** with strict typing and no use of `any`
- **Environment-aware configuration** with automatic setup based on environment variables
- **Security features** with forbidden keys filtering and redaction
- **Extensible architecture** - Easy to add custom transports and formatters using duck-typing

## [1.0.0] - 2024-01-15

### Added

- Initial release of `strogger`
- **Structured JSON logging** as the core feature
- Functional programming approach with dependency injection
- Duck-typing for maximum extensibility
- Multiple transport support
- Advanced logging features
- Comprehensive documentation and examples
## [1.1.0] - 2025-07-01 (MINOR RELEASE)

### ✨ Features

- setup bumper-cli with git hooks and GitHub workflows (10c8de1c)
- optimize package.json and README.md for better NPM discoverability (18c34216)
- initial commit (4b531ab5)

### 🐛 Bug Fixes

- correct package name in changelog from @cdk-insights/logger to strogger (1a049ae6)

### 🔨 Chores

- add bumper-cli as dev dependency (27f3f347)

### 👥 Contributors

Thanks to Lee Priest for contributing to this release!

## [2.1.0] - 2025-07-01 (MINOR RELEASE)

### 🐛 Bug Fixes

- remove unused LogEntry import to resolve TypeScript build error (4ff664f8)
- **examples:** prevent top-level instantiation of third-party transports and loggers in examples\n\n- Only create transports/loggers inside functions\n- Only run examples if file is executed directly\n- Prevents errors on import when required env vars are missing (ee19da9e)
- correct package name in changelog from @cdk-insights/logger to strogger (1a049ae6)

### 🔨 Chores

- release v2.0.0 (be01e447)
- add bumper-cli as dev dependency (27f3f347)

### ✨ Features

- setup bumper-cli with git hooks and GitHub workflows (10c8de1c)
- optimize package.json and README.md for better NPM discoverability (18c34216)
- initial commit (4b531ab5)

### 👥 Contributors

Thanks to Lee Priest for contributing to this release!

## [2.1.0] - 2025-07-01 (MINOR RELEASE)

### ✨ Features

- improve environment variable handling and documentation (f8476bf8)

### 👥 Contributors

Thanks to Lee Priest for contributing to this release!

## [2.0.3] - 2025-07-01 (PATCH RELEASE)

### 🐛 Bug Fixes

- convert vitest config to CommonJS to resolve ES module compatibility issue (6c7f3d94)

### 👥 Contributors

Thanks to Lee Priest for contributing to this release!

