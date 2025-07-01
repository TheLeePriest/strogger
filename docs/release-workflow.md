# Release Workflow

This document describes the release workflow for the `@cdk-insights/logger` library using `bumper-cli`.

## 🚀 Release Process

The library uses `bumper-cli` to automate the release process, ensuring consistent versioning, changelog updates, and git operations.

## 📋 Prerequisites

1. **Node.js 18+** installed
2. **Git** configured with proper credentials
3. **npm** access to publish to the registry
4. **bumper-cli** installed (already included as dev dependency)

## 🔧 Available Scripts

### **Release Management**

```bash
# Create a new release (bumps version, updates changelog, commits, tags, pushes)
npm run release

# Bump version only (patch, minor, major)
npm run bump

# Generate changelog
npm run changelog

# Commit changes with structured message
npm run commit
```

### **Development Workflow**

```bash
# Build the project
npm run build

# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format
```

## 📝 Release Types

### **Patch Release** (Bug fixes)
```bash
npm run bump -- patch
# or
npm run release -- patch
```

### **Minor Release** (New features, backward compatible)
```bash
npm run bump -- minor
# or
npm run release -- minor
```

### **Major Release** (Breaking changes)
```bash
npm run bump -- major
# or
npm run release -- major
```

## 🔄 Release Workflow Steps

When you run `npm run release`, the following happens automatically:

1. **Version Bump**: Increments version in `package.json`
2. **Changelog Update**: Updates `CHANGELOG.md` with new version
3. **Git Commit**: Creates a structured commit with release message
4. **Git Tag**: Creates a version tag
5. **Git Push**: Pushes changes and tags to remote repository
6. **npm Publish**: Publishes to npm registry (if configured)

## 📊 Structured Logging Focus in Releases

Every release emphasizes the **structured logging** core feature:

### **Release Commit Message**
```
chore: release v{version}

Structured logging library with functional programming, duck-typing, and comprehensive third-party integrations.

- Structured JSON logging for all outputs
- Multiple transport support (Console, DataDog, Splunk, Elasticsearch, New Relic, CloudWatch)
- Advanced features: filtering, validation, redaction, sampling, rate limiting
- Performance monitoring and correlation tracking
- Comprehensive error handling with actionable messages
- AWS Lambda optimized
- TypeScript-first with strict typing
```

### **Release Tag Message**
```
v{version}

Structured logging library with functional programming, duck-typing, and comprehensive third-party integrations.
```

## 📝 Changelog Structure

The changelog follows [Keep a Changelog](https://keepachangelog.com/) format and emphasizes structured logging:

```markdown
## [Unreleased]

### Added
- **Core structured JSON logging** - All logs output in structured JSON format
- New transport support
- Advanced features

### Changed
- Improved structured logging performance
- Enhanced JSON schema consistency

### Fixed
- Structured logging format issues
- Transport integration bugs
```

## 🎯 Release Checklist

Before releasing:

- [ ] All tests pass (`npm test`)
- [ ] Code is linted (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] Documentation is updated
- [ ] Changelog is current
- [ ] Version is appropriate (patch/minor/major)
- [ ] Structured logging examples are working
- [ ] All transports are tested

## 🔧 Configuration

The bumper configuration is in `package.json`:

```json
{
  "bumper": {
    "changelog": {
      "path": "CHANGELOG.md",
      "format": "markdown"
    },
    "commit": {
      "message": "chore: release v{version}",
      "body": "Structured logging library with..."
    },
    "tag": {
      "message": "v{version}",
      "body": "Structured logging library with..."
    }
  }
}
```

## 🚀 Quick Release Example

```bash
# 1. Ensure everything is ready
npm test
npm run lint
npm run format

# 2. Create a patch release
npm run release -- patch

# 3. Verify the release
git log --oneline -5
git tag -l | tail -5
```

## 📈 Release History

The library maintains a complete release history in `CHANGELOG.md`, with each release emphasizing the structured logging capabilities and improvements.

## 🎯 Structured Logging in Releases

Every release highlights:

- **Structured JSON logging** as the core feature
- **Consistent schema** across all log entries
- **Machine-readable format** for automation
- **Correlation capabilities** for distributed tracing
- **Third-party integration** support
- **Performance optimizations** for high-volume logging

This ensures that the structured logging focus remains central to every release and update. 