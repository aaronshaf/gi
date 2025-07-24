# Development Guide

This document contains information for developers working on the Gerrit CLI project.

## Prerequisites

- **Bun 1.0+** - Primary runtime and package manager
- **Node.js 18+** - For tooling compatibility
- **Git** - Version control

## Getting Started

### Initial Setup
```bash
git clone https://github.com/your-org/gerrit-cli
cd gerrit-cli
bun install
```

### Development Commands
```bash
# Development
bun run dev                 # Run CLI in development mode
bun run dev --help          # Show CLI help
bun run build              # Build for production

# Testing
bun test                   # Run all tests
bun run test:coverage      # Run tests with coverage report
bun test tests/unit/       # Run only unit tests
bun test tests/integration/ # Run only integration tests

# Code Quality
bun run typecheck          # TypeScript type checking
bun run lint               # Run oxlint
bun run format             # Format code with Biome
bun run format:check       # Check code formatting
bun run check:all          # Run all checks (typecheck, lint, format, test)
```

## Architecture

The project follows a clean, functional architecture using Effect:

### Directory Structure
```
src/
├── cli/              # Ink components and command definitions
│   ├── commands/     # Individual command implementations
│   └── index.ts      # Main CLI entry point
├── services/         # Effect services
│   └── config.ts     # Configuration management
├── api/              # Gerrit REST API client
│   └── gerrit.ts     # API service implementation
├── db/               # SQLite caching layer
│   ├── database.ts   # Database service
│   └── schema.ts     # SQL schema definitions
├── schemas/          # Effect Schema definitions
│   └── gerrit.ts     # Type-safe data models
├── i18n/             # Internationalization (future)
└── utils/            # Shared utilities

tests/
├── unit/             # Unit tests
├── integration/      # Integration tests
├── mocks/            # MSW mock handlers
└── setup.ts          # Test setup and configuration
```

### Key Technologies

- **Effect** - Functional effect system for managing side effects
- **Effect Schema** - Type-safe data validation and transformation
- **Ink** - React for CLIs, providing interactive terminal UI
- **Bun SQLite** - Built-in SQLite support for caching
- **MSW** - Mock Service Worker for API testing
- **Commander.js** - CLI argument parsing

### Design Principles

1. **Functional Programming** - Use Effect for all side effects
2. **Type Safety** - Leverage TypeScript with strict settings
3. **Local-First** - Cache everything, work offline when possible
4. **Error Handling** - Comprehensive error types and handling
5. **Testing** - High test coverage with shared schemas

## Code Quality Standards

### TypeScript Configuration
- `isolatedDeclarations: true` - Explicit type exports
- `noImplicitAny: true` - No implicit any types
- `strictNullChecks: true` - Strict null checking
- Only `.ts` files allowed (no `.js/.jsx/.tsx`)

### Linting & Formatting
- **oxlint** - Fast, strict linting
- **Biome** - Consistent code formatting
- **ast-grep** - Pattern-based code rules

### File Size Limits
- **Warning** at 500 lines
- **Error** at 700 lines
- Enforced in pre-commit hooks

### Banned Patterns
- `as` type casting (except `as const` and `as unknown`)
- `--no-verify` flag usage
- Implicit any types
- console.log in production code

## Testing Strategy

### Test Types
1. **Unit Tests** - Pure functions, schemas, utilities
2. **Integration Tests** - API clients with MSW mocks
3. **Component Tests** - CLI command behavior

### Shared Schemas
Test mocks use the same Effect Schemas as production code, ensuring type safety and consistency.

### Coverage Requirements
- **Minimum 80%** line coverage
- **Minimum 80%** function coverage
- **Minimum 80%** branch coverage
- **Minimum 80%** statement coverage

### Running Tests
```bash
# All tests
bun test

# Watch mode
bun test --watch

# Specific test file
bun test tests/unit/schemas/gerrit.test.ts

# Coverage report
bun run test:coverage
```

## Git Workflow

### Branch Strategy
- `main` branch for stable releases
- Feature branches: `feat/feature-name`
- Bug fixes: `fix/bug-description`
- Use conventional commit messages

### Pre-commit Hooks
Automatically run on every commit:
- TypeScript type checking
- Code linting (oxlint)
- Code formatting check (Biome)
- File size validation
- ast-grep pattern checks
- Tests for changed files

### Pre-push Hooks
Run before pushing to remote:
- Full test suite
- Code coverage validation
- Complete build verification
- All linting and formatting checks

### Conventional Commits
```bash
feat: add support for patch comparison
fix: handle empty diff responses
docs: update API documentation
test: add integration tests for diff command
refactor: simplify error handling logic
```

## Adding New Commands

### 1. Define Schema
Add types to `src/schemas/gerrit.ts`:
```typescript
export const NewCommandOptions = Schema.Struct({
  option1: Schema.String,
  option2: Schema.optional(Schema.Number),
})
export type NewCommandOptions = Schema.Schema.Type<typeof NewCommandOptions>
```

### 2. Extend API Service
Add methods to `src/api/gerrit.ts`:
```typescript
readonly newMethod: (param: string) => Effect.Effect<ReturnType, ApiError>
```

### 3. Create Command Component
Create `src/cli/commands/new-command.tsx`:
```typescript
import React from 'react'
import { Box, Text } from 'ink'
// Implementation...
```

### 4. Register Command
Add to `src/cli/index.ts`:
```typescript
program
  .command('new-command <param>')
  .description('Description of new command')
  .action(/* implementation */)
```

### 5. Add Tests
Create test files in `tests/unit/` and `tests/integration/`

### 6. Update Documentation
Update README.md with usage examples

## Database Management

### Schema Changes
1. Update `src/db/schema.ts` with new tables/columns
2. Add migration logic to `src/db/database.ts`
3. Test with fresh database creation
4. Update cache invalidation logic if needed

### Caching Strategy
- **Cache-first** - Always check local cache first
- **Smart invalidation** - Update cache on write operations
- **Offline support** - Gracefully handle network failures

## MSW Mock Setup

### Adding New API Endpoints
1. Define response schema in `src/schemas/gerrit.ts`
2. Add handler to `tests/mocks/handlers.ts`
3. Use schema validation in mock responses
4. Test both success and error cases

### Mock Data Generation
```typescript
const mockData: Schema.Schema.Type<typeof YourSchema> = {
  // Properly typed mock data
}

const validated = Schema.decodeUnknownSync(YourSchema)(mockData)
return HttpResponse.json(validated)
```

## Performance Considerations

### Caching
- Cache API responses in SQLite
- Implement cache expiration
- Provide cache management commands

### Bundle Size
- Use dynamic imports for large dependencies
- Tree-shake unused code
- Monitor bundle size in CI

### CLI Responsiveness
- Show loading indicators
- Stream large outputs
- Implement request cancellation

## Security Guidelines

### Credential Storage
- Store in `~/.gi/credentials.json` with 600 permissions
- Never log credentials
- Use secure environment variable handling

### API Communication
- Always use HTTPS
- Validate all inputs with Effect Schema
- Handle authentication errors gracefully

### Error Messages
- Never expose sensitive information
- Provide helpful debugging information
- Log errors for debugging without sensitive data

## Release Process

### Version Management
- Use semantic versioning (semver)
- Update version in `package.json`
- Create git tags for releases

### Build Process
```bash
bun run build              # Build optimized bundle
bun test                   # Ensure all tests pass
bun run check:all          # Run all quality checks
```

### Distribution
- Create platform-specific binaries
- Upload to GitHub releases
- Update installation instructions

## Contributing Guidelines

### Code Review Checklist
- [ ] All tests pass
- [ ] Code coverage maintained
- [ ] TypeScript strict mode compliance
- [ ] Follows existing patterns
- [ ] Documentation updated
- [ ] Error handling implemented
- [ ] Security considerations addressed

### Pull Request Process
1. Create feature branch
2. Implement changes with tests
3. Run `bun run check:all`
4. Create pull request with description
5. Address review feedback
6. Merge after approval

## Troubleshooting

### Common Development Issues

**Build failures**
```bash
rm -rf node_modules bun.lockb
bun install
```

**Test failures**
```bash
bun test --verbose
```

**Type errors**
```bash
bun run typecheck
```

**Lint errors**
```bash
bun run format  # Auto-fix formatting
bun run lint    # Check for issues
```

### Debug Mode
```bash
DEBUG=1 bun run dev <command>  # Enable debug logging
```

### Database Issues
```bash
rm -rf ~/.gi/cache.db  # Reset local cache
```

## Resources

- [Effect Documentation](https://effect.website/)
- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [Bun Documentation](https://bun.sh/docs)
- [MSW Documentation](https://mswjs.io/)
- [Gerrit REST API](https://gerrit-review.googlesource.com/Documentation/rest-api.html)