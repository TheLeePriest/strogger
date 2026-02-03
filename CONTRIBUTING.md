# Contributing to Strogger

Thank you for your interest in contributing to Strogger! This document provides guidelines for contributing.

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/strogger.git
   cd strogger
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run tests:
   ```bash
   npm test
   ```

4. Build the project:
   ```bash
   npm run build
   ```

## Project Structure

```
strogger/
├── src/
│   ├── formatters/      # Log formatters (JSON, pretty)
│   ├── transports/      # Transport implementations
│   ├── utils/           # Utility functions
│   ├── middleware/      # Express/Fastify middleware
│   ├── examples/        # Example usage patterns
│   ├── logger.ts        # Core logger implementation
│   ├── types.ts         # TypeScript type definitions
│   └── index.ts         # Public exports
├── test/                # Test files
├── benchmarks/          # Performance benchmarks
└── docs/                # Documentation
```

## Code Style

- Use TypeScript for all source files
- Follow the existing code style (enforced by ESLint and Prettier)
- Write tests for new features
- Keep functions small and focused
- Use descriptive variable and function names

## Running Checks

```bash
# Run all checks
npm test

# Run linting
npm run lint

# Run type checking
npm run build

# Run benchmarks
npx tsx benchmarks/throughput.ts
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests and linting
5. Commit your changes with a clear message
6. Push to your fork
7. Open a Pull Request

### Commit Messages

Use clear, descriptive commit messages:

- `feat: add DataDog transport`
- `fix: handle null context values`
- `docs: update API documentation`
- `test: add tests for child loggers`
- `refactor: simplify queue processing`

## Testing

- Write tests for new features
- Ensure existing tests pass
- Aim for meaningful coverage of edge cases

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run a specific test file
npm test -- test/logger.test.ts
```

## Adding a New Transport

1. Create a new file in `src/transports/`
2. Implement the `Transport` interface
3. Add tests in `test/transports/`
4. Export from `src/index.ts`
5. Add documentation

Example transport structure:

```typescript
import type { LogEntry, Transport, Formatter } from "../types";
import { LogLevel } from "../types";

export interface MyTransportOptions {
  formatter: Formatter;
  level?: LogLevel;
  // ... transport-specific options
}

export const createMyTransport = (options: MyTransportOptions): Transport => {
  let currentLevel = options.level ?? LogLevel.INFO;

  return {
    log: async (entry: LogEntry): Promise<void> => {
      if (entry.level < currentLevel) return;
      // Implement logging logic
    },

    flush: async (): Promise<void> => {
      // Flush any buffered logs
    },

    setLevel: (level: LogLevel): void => {
      currentLevel = level;
    },

    getLevel: (): LogLevel => currentLevel,
  };
};
```

## Reporting Issues

When reporting issues, please include:

- Node.js version
- Strogger version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Error messages (if any)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
