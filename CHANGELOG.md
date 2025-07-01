# Changelog

All notable changes to the `strogger` library will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- **Branded API functions** - `createStrogger()` and `createStrogger*Transport()` functions for brand consistency

### Features

- **Structured JSON Logging**: Every log entry is automatically formatted as structured JSON with consistent schema
- **Duck-Typing**: Any object with `log()`, `setLevel()`, and `getLevel()` methods can be a transport
- **Dependency Injection**: Pure functions with explicit dependencies for easy testing and composition
- **Third-Party Integrations**: Built-in transports for popular logging services with batching and error handling
- **Performance Monitoring**: Built-in performance tracking with timing, metrics, and correlation IDs
- **Advanced Log Management**: Filtering, validation, redaction, sampling, rate limiting, and enrichment
- **Error Handling**: Comprehensive error handling with detailed error messages and solutions
- **AWS Integration**: Optimized for AWS Lambda with CloudWatch log rotation and stream management

### Documentation

- Comprehensive README with quick start guide
- Advanced features documentation
- Third-party integration guides
- Error handling guide
- Log rotation and file management documentation
- CloudWatch integration guide
- Multiple usage examples and best practices

## [1.0.0] - 2024-01-15

### Added

- Initial release of `strogger`
- **Structured JSON logging** as the core feature
- Functional programming approach with dependency injection
- Duck-typing for maximum extensibility
- Multiple transport support
- Advanced logging features
- Comprehensive documentation and examples
