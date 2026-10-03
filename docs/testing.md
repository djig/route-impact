# Testing

## Test Coverage: 24/27 (89%)

### Test Suite

Location: `src/__tests__/route-analyzer-complete.test.ts`

Fixture app: `src/__tests__/fixtures/complete-app/` - Complete Next.js structure with all routing features

### Passing Tests (24)

**App Router:**
- Root & nested layouts
- Template, loading, error files
- Route groups `(marketing)`
- Dynamic `[slug]`, catch-all `[...slug]`, optional `[[...slug]]`
- Parallel routes `@modal`, intercepting routes `(.)photo`
- Route handlers
- Middleware & next.config (global files)

**Dependencies:**
- Path aliases (`@/`, `~/`)
- Barrel re-exports (`export *`, `export { X }`)
- CSS modules

**Pages Router:**
- Dynamic routes
- `_document.tsx`

**Other:**
- Route expansion with params
- Dynamic imports

### Known Issues (3)

See [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) for details on edge cases.

## Running Tests

```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
```

## Adding Tests

1. Add fixture files to `src/__tests__/fixtures/complete-app/`
2. Add test case to `route-analyzer-complete.test.ts`
3. Run tests to verify
