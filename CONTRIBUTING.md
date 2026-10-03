# Contributing to route-impact

Thank you for your interest in contributing to route-impact! This document provides guidelines and instructions for development.

## Development Setup

### Prerequisites

- Node.js 18 or later
- npm 8 or later
- Git

### Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/djig/route-impact.git
   cd route-impact
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

5. **Run the demo**:
   ```bash
   cd examples/demo-app
   ./demo.sh
   ```

## Project Structure

```
route-impact/
├── src/
│   ├── index.ts              # Main entry point and RouteImpact class
│   ├── cli.ts                # CLI implementation
│   ├── types.ts              # TypeScript type definitions
│   ├── dependency-graph.ts   # Dependency graph builder
│   ├── route-analyzer.ts     # Route analysis logic
│   ├── git-diff.ts           # Git diff parser
│   ├── verifier.ts           # Before/after verification with Playwright
│   ├── reporter.ts           # Report generation (markdown/JSON)
│   └── __tests__/            # Test files
├── examples/
│   └── demo-app/             # Example Next.js app with demo script
├── dist/                     # Compiled JavaScript (generated)
├── SKILL.md                  # Agent skill documentation
├── action.yml                # GitHub Action definition
└── package.json
```

## Development Workflow

### 1. Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes in the `src/` directory

3. Build and test:
   ```bash
   npm run build
   npm test
   ```

4. Test the CLI locally:
   ```bash
   node dist/cli.js analyze --working-tree
   ```

### 2. Adding Tests

We use Vitest for testing. Tests are located in `src/__tests__/`.

**Example test**:
```typescript
import { describe, it, expect } from 'vitest';
import { RouteAnalyzer } from '../route-analyzer';

describe('RouteAnalyzer', () => {
  it('should detect dynamic routes', () => {
    const analyzer = new RouteAnalyzer('/path/to/project');
    const routes = analyzer.analyzeAffectedRoutes(['app/blog/[slug]/page.tsx']);
    
    expect(routes[0].dynamic).toBe(true);
    expect(routes[0].params).toContain('slug');
  });
});
```

Run tests in watch mode:
```bash
npm run test:watch
```

### 3. Type Checking

Ensure your code passes TypeScript checks:
```bash
npm run typecheck
```

### 4. Linting

Run ESLint:
```bash
npm run lint
```

### 5. Running CI Locally

Before pushing, run the full CI suite:
```bash
npm run ci
```

This runs: lint, typecheck, test, and build.

## Code Style

- Use **TypeScript** with strict mode enabled
- Follow existing code formatting (2-space indentation)
- Prefer named exports over default exports
- Add JSDoc comments for public APIs
- Keep functions focused and testable

## Testing Guidelines

### Unit Tests

- Test individual functions and classes in isolation
- Mock external dependencies (filesystem, git, network)
- Focus on edge cases and error handling

### Integration Tests

- Test the full workflow (analyze, verify, report)
- Use fixture Next.js apps in `src/__tests__/fixtures/`
- Clean up temporary files after tests

### Example Fixtures

Create realistic Next.js app structures:
```
fixtures/
├── app-router/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── blog/
│   │       └── [slug]/
│   │           └── page.tsx
│   └── components/
│       └── Button.tsx
```

## Documentation

### README

Update the main README.md when:
- Adding new features
- Changing CLI options
- Adding configuration options

### SKILL.md

Update the agent skill documentation for:
- New commands or workflows
- Configuration changes
- Best practices updates

### API Documentation

Add JSDoc comments for public APIs:
```typescript
/**
 * Analyzes affected routes based on changed files.
 * 
 * @param changedFiles - Array of file paths that changed
 * @returns Array of affected route objects with import chains
 */
public analyzeAffectedRoutes(changedFiles: string[]): AffectedRoute[] {
  // ...
}
```

## Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality
- **PATCH** version for backwards-compatible bug fixes

## Pull Request Process

1. **Fork the repository** and create your branch from `main`

2. **Make your changes** with tests

3. **Update documentation** as needed

4. **Run the CI suite**:
   ```bash
   npm run ci
   ```

5. **Commit your changes** with clear messages:
   ```bash
   git commit -m "feat: add support for intercepting routes"
   ```

   Use conventional commit prefixes:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `test:` for test updates
   - `refactor:` for code refactoring
   - `chore:` for maintenance tasks

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request** on GitHub with:
   - Clear title and description
   - Link to related issues
   - Screenshots/examples if applicable

## Feature Requests and Bug Reports

### Opening an Issue

When opening an issue:
1. Search existing issues first
2. Use a clear, descriptive title
3. Provide steps to reproduce (for bugs)
4. Include your environment (Node.js version, OS, Next.js version)
5. Add code samples or screenshots when helpful

### Bug Report Template

```markdown
**Description**: Brief description of the bug

**Steps to Reproduce**:
1. Create a Next.js app with...
2. Run `route-impact analyze...`
3. Observe error...

**Expected Behavior**: What should happen

**Actual Behavior**: What actually happens

**Environment**:
- route-impact version: 0.1.0
- Node.js version: 18.0.0
- Next.js version: 16.3.0
- OS: macOS 14.0
```

## Areas for Contribution

We welcome contributions in these areas:

### High Priority
- **Better CSS tracking**: Support for styled-components, Emotion, CSS-in-JS
- **Barrel export resolution**: Improve tracing through barrel files
- **Visual diff**: Pixel-by-pixel screenshot comparison
- **Performance**: Optimize for large codebases (1000+ files)

### Medium Priority
- **More frameworks**: Remix, SvelteKit, Nuxt support
- **Monorepo support**: Cross-package dependency tracking
- **MCP server**: Model Context Protocol integration
- **Browser extension**: PR review UI in GitHub/GitLab

### Documentation
- **Video tutorials**: Screen recordings of common workflows
- **Blog posts**: Case studies and best practices
- **Translations**: Non-English documentation

### Examples
- **More demo apps**: Pages Router, middleware, intercepting routes
- **Integration examples**: CI/CD pipelines, Docker, Vercel

## Questions?

- **Discussions**: Use GitHub Discussions for questions
- **Chat**: Join our Discord (link in README)
- **Email**: contact@route-impact.dev

## Code of Conduct

Be respectful, inclusive, and collaborative. We're all here to build better tools.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to route-impact! 🚀
