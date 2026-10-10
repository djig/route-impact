# route-impact

> **Experimental v0.1** - Compute affected Next.js routes from git diffs and verify them with screenshots, accessibility scans, and Web Vitals

[![CI](https://github.com/djig/route-impact/actions/workflows/ci.yml/badge.svg)](https://github.com/djig/route-impact/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Problem

When you change a Next.js app, **nobody knows which routes are actually affected**. Next.js 16.3 tells agents to "re-check affected routes," but no tool computes that list. Existing tools capture and compare once you tell them what to look at. **route-impact figures out which routes those are.**

## What It Does

1. **Analyzes git diffs** to compute affected Next.js routes via dependency graph
2. **Explains why** each route is affected (import chain from changed files)
3. **Optionally verifies** with Playwright screenshots, axe accessibility scans, and Web Vitals

**Supports:** App Router (layouts, templates, loading, error, dynamic/catch-all routes, route groups, parallel/intercepting routes), Pages Router, middleware, path aliases, barrel exports, CSS modules.

## Installation

### From GitHub

```bash
npm install -g github:djig/route-impact
```

### From Source

```bash
git clone https://github.com/djig/route-impact.git
cd route-impact
npm install
npm run build
npm link
```

### npm Registry (Coming Soon)

```bash
npm install -g route-impact
```

The package is not yet published to npm. Use the GitHub or source installation methods above.

## Quick Start

### CLI: Analyze Routes

```bash
# Analyze working tree
route-impact analyze --working-tree --format markdown

# Compare branches
route-impact analyze --base main --head feature-branch
```

### CLI: Verify with Screenshots

```bash
route-impact verify \
  --base main \
  --head HEAD \
  --base-url http://localhost:3000 \
  --head-url http://localhost:3001 \
  --output-dir verification-report
```

### GitHub Action

```yaml
- uses: djig/route-impact@main
  with:
    analyze-only: 'true'
    post-comment: 'true'
```

**Note:** Replace `@main` with a specific commit SHA for production use to pin the version. Tags and releases are coming soon.

### Agent Skill

Ships with `SKILL.md` for Claude Code, Cursor, Copilot, Codex, etc.

## Configuration

Create `route-impact.config.json`:

```json
{
  "dynamicParams": {
    "slug": ["intro", "getting-started", "advanced"],
    "id": ["1", "2", "3"]
  },
  "webVitalsThresholds": {
    "absoluteMs": 10,
    "relativePercent": 10,
    "cls": 0.05,
    "perMetric": {
      "LCP": 50,
      "FID": 10,
      "FCP": 10,
      "TTFB": 10
    }
  }
}
```

### Web Vitals Thresholds

Configure noise thresholds to avoid flagging insignificant performance changes:

- **`absoluteMs`** (default: 10): Minimum absolute difference in milliseconds to flag as regression
- **`relativePercent`** (default: 10): Minimum relative difference as percentage to flag as regression
- **`cls`** (default: 0.05): Threshold for Cumulative Layout Shift (unitless)
- **`perMetric`**: Per-metric absolute thresholds that override the global `absoluteMs` setting
  - **`LCP`** (default: 50ms): Largest Contentful Paint threshold
  - **`FID`** (default: 10ms): First Input Delay threshold
  - **`FCP`** (default: 10ms): First Contentful Paint threshold
  - **`TTFB`** (default: 10ms): Time to First Byte threshold

A regression is only flagged if the delta exceeds **both** the absolute AND relative thresholds (or the per-metric threshold).

## Example Output

```markdown
# Route Impact Report

**Base:** `main`  
**Head:** `feature-branch`

## Affected Routes

### /blog
- **File:** `app/blog/page.tsx`
- **Import Chain:**
    ↳ `components/Header.tsx` (changed)

### /blog/[slug]
- **Dynamic Params:** `slug`
- **Import Chain:**
    ↳ `components/Header.tsx` (changed)
```

## How It Works

1. **Dependency Graph**: Parses imports/exports to build complete module graph
2. **Route Discovery**: Scans `app/` and `pages/` for all route files
3. **Impact Analysis**: Traces which routes import changed files (directly or transitively)
4. **Verification** (optional): Playwright captures + axe + Web Vitals on affected routes only

## Features

### App Router ✅
- Pages, layouts, templates, loading, error, not-found
- Dynamic `[param]`, catch-all `[...param]`, optional `[[...param]]`
- Route groups `(group)`, parallel `@slot`, intercepting `(.)`
- Route handlers, middleware

### Pages Router ✅
- Pages, `_app`, `_document`, dynamic routes

### Dependencies ✅
- Path aliases (`@/`, `~/` from tsconfig)
- Barrel exports (`export *`, `export { X }`)
- CSS modules and global CSS

## Programmatic API

```typescript
import { RouteImpact } from 'route-impact';

const impact = new RouteImpact({
  baseDir: process.cwd(),
  gitDiff: { base: 'main', head: 'HEAD' },
});

const report = await impact.analyze();
console.log(`Affected: ${report.affectedRoutes.length} routes`);

// With verification
const verified = await impact.verify(
  'http://localhost:3000',
  'http://localhost:3001',
  './report'
);
```

## CLI Commands

### `analyze`
```bash
route-impact analyze [options]

Options:
  -b, --base <ref>       Base git ref
  -h, --head <ref>       Head git ref  
  -w, --working-tree     Analyze working tree
  -d, --dir <path>       Project directory
  -o, --output <path>    Output file
  -f, --format <fmt>     json | markdown
  -c, --config <path>    Config file
```

### `verify`
```bash
route-impact verify [options]

Options:
  --base-url <url>       Base URL (required)
  --head-url <url>       Head URL (required)
  -o, --output-dir <path>  Output directory
  All analyze options also supported
```

## Test Coverage

**24/27 tests passing (89%)**

Comprehensive test suite covering:
- All App Router route types
- Pages Router
- Path aliases and barrel exports
- CSS modules
- Dynamic route expansion
- Middleware and config as global files

See [docs/testing.md](docs/testing.md) for details.

## Known Limitations

- Barrel exports through very deep chains may need multiple hops
- Dynamic `import()` detected syntactically, not evaluated at runtime
- Monorepos: analyzes specified directory only
- CSS-in-JS (styled-components, Emotion) not tracked

Full details: [KNOWN_ISSUES.md](KNOWN_ISSUES.md)

## Documentation

- [Testing](docs/testing.md) - Test coverage and fixtures
- [API Reference](docs/api.md) - Programmatic usage
- [GitHub Action](docs/github-action.md) - CI/CD setup
- [Agent Skill](SKILL.md) - For coding agents
- [Contributing](CONTRIBUTING.md) - Development guide

## Example

See [`examples/demo-app/`](examples/demo-app/) with scripted demo:

```bash
cd examples/demo-app
./demo.sh
```

## License

MIT © [Jignesh Dhamecha](https://github.com/djig)

## Related Tools

- [agent-browser](https://github.com/vercel-labs/agent-browser) - Browser testing with React DevTools
- [before-and-after](https://github.com/vercel-labs/before-and-after) - Screenshot comparison (needs URL list)
- [Playwright](https://playwright.dev/) - Browser automation (used internally)

---

**Status**: Experimental v0.1 | Feedback welcome!

---

More Claude Code tools by [@djig](https://github.com/djig): [ui-loop](https://github.com/djig/ui-loop) (token-budgeted visual feedback MCP) · [drift-guard](https://github.com/djig/drift-guard) (blocks stale React/Next/Tailwind patterns) · [claude-onair](https://github.com/djig/claude-onair) (desk status light mod)
