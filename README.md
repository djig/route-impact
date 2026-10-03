# route-impact

> **Experimental v0.1** - Compute affected Next.js routes from git diffs and verify them with before/after screenshots, accessibility scans, and Web Vitals

[![npm version](https://badge.fury.io/js/route-impact.svg)](https://www.npmjs.com/package/route-impact)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Problem

When a coding agent (or human) changes a Next.js app, **nobody knows which routes are actually affected**, so verification is either everything (slow) or nothing. Next.js 16.3's own guidance tells agents to "re-check affected routes with before/after captures," but no tool works out which routes those are.

Existing tools ([agent-browser](https://github.com/vercel-labs/agent-browser), [Playwright MCP](https://github.com/microsoft/playwright-mcp), [before-and-after](https://github.com/vercel-labs/before-and-after), [Argos](https://argos-ci.com), Lighthouse CI) capture and compare once you tell them what to look at. **route-impact complements them by computing that list automatically.**

## What It Does

1. **Analyze Affected Routes**: Given a git diff (base..head, or the working tree), compute the set of affected Next.js routes by building a module dependency graph. Supports:
   - App Router: pages, layouts, templates, loading, error, route handlers
   - Pages Router: pages and API routes
   - Shared components, hooks, CSS modules, middleware, and `next.config`
   - Dynamic segments, route groups, parallel/intercepting routes
   - Path aliases from `tsconfig.json`

2. **Explain Impact**: Each affected route includes the import chain showing why it's affected (the path from changed files to the route).

3. **Before/After Verification** (optional): Start base and head builds or dev servers, then:
   - Capture screenshots with Playwright
   - Run accessibility scans with axe-core
   - Measure Web Vitals (LCP, FID, CLS, FCP, TTFB)
   - Output a concise diff report (markdown + JSON)

4. **Dynamic Route Expansion**: Configure sample parameters for dynamic routes (e.g., `/blog/[slug]`) via a config file.

## Installation

```bash
npm install -g route-impact
```

Or use directly with `npx`:

```bash
npx route-impact analyze --working-tree
```

## Quick Start

### CLI: Analyze Affected Routes

```bash
# Analyze working tree changes
route-impact analyze --working-tree --format markdown

# Analyze a git diff between branches
route-impact analyze --base main --head feature-branch --output routes.json
```

**Output**:
```markdown
# Route Impact Report

**Generated:** 2026-10-03 10:30:45

## Summary

- **Total Routes Affected:** 3
- **Static Routes:** 2
- **Dynamic Routes:** 1

## Affected Routes

### /
- **Type:** page
- **File:** `app/page.tsx`

**Import Chain:**
  ↳ `components/Header.tsx`
    ↳ `components/Button.tsx` (changed)

### /blog
- **Type:** page
- **File:** `app/blog/page.tsx`

**Import Chain:**
  ↳ `components/Header.tsx`
    ↳ `components/Button.tsx` (changed)
```

### CLI: Verify Routes with Before/After Testing

```bash
# Run both base and head builds/dev servers first
# Base (before): http://localhost:3000
# Head (after): http://localhost:3001

route-impact verify \
  --base main \
  --head HEAD \
  --base-url http://localhost:3000 \
  --head-url http://localhost:3001 \
  --output-dir verification-report
```

**Produces**:
- Before/after screenshots of each affected route
- Accessibility violation diffs
- Web Vitals deltas
- Markdown report with summary

### GitHub Action: Post PR Comments

Add to `.github/workflows/route-impact.yml`:

```yaml
name: Route Impact Analysis

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install route-impact
        run: npm install -g route-impact

      - name: Analyze affected routes
        uses: route-impact@v0.1
        with:
          base-ref: ${{ github.event.pull_request.base.sha }}
          head-ref: ${{ github.event.pull_request.head.sha }}
          analyze-only: 'true'
          post-comment: 'true'
```

### Agent Skill: For Coding Agents

route-impact ships with a `SKILL.md` file compatible with Claude Code, Cursor, Copilot, Codex, and other coding agents.

**Install the skill**:
```bash
# The skill is bundled with the npm package
cat $(npm root -g)/route-impact/SKILL.md
```

**Agent workflow**:
1. After making frontend changes, run `route-impact analyze --working-tree`
2. Review the import chain to understand blast radius
3. For critical changes, run full verification with `route-impact verify`
4. Mention affected routes and verification results in PR descriptions

## Configuration

Create `route-impact.config.json` in your project root:

```json
{
  "dynamicParams": {
    "slug": ["intro", "getting-started", "advanced"],
    "id": ["1", "2", "3"]
  },
  "pathAliases": {
    "@": ".",
    "~": "src"
  }
}
```

- **`dynamicParams`**: Sample values for dynamic route segments
- **`pathAliases`**: Custom path aliases (auto-loaded from `tsconfig.json` if not specified)

## How It Works

1. **Dependency Graph**: Parses TypeScript/JavaScript files using `@typescript-eslint/parser` to extract imports
2. **Route Discovery**: Scans `app/` (App Router) and `pages/` (Pages Router) for route files
3. **Impact Analysis**: Builds reverse import graph to find all routes that transitively import changed files
4. **Verification** (optional): Launches Playwright to capture screenshots and run axe/Web Vitals checks

## Supported Next.js Features

### App Router (Next.js 13+)
- ✅ Pages (`page.tsx`)
- ✅ Layouts (`layout.tsx`)
- ✅ Templates (`template.tsx`)
- ✅ Loading UI (`loading.tsx`)
- ✅ Error handling (`error.tsx`)
- ✅ Route handlers (`route.ts`)
- ✅ Dynamic segments (`[param]`, `[...slug]`, `[[...slug]]`)
- ✅ Route groups (`(group)`)
- ✅ Parallel routes (`@folder`)
- ✅ Intercepting routes (`(.)folder`)

### Pages Router (Next.js 12 and earlier)
- ✅ Pages (`pages/index.tsx`, `pages/blog/[slug].tsx`)
- ✅ API routes (`pages/api/`)

### Global
- ✅ Middleware (`middleware.ts`)
- ✅ Config (`next.config.js`, `next.config.mjs`)
- ✅ CSS Modules, global CSS
- ✅ Path aliases from `tsconfig.json`

## Example Demo

See [`examples/demo-app/`](./examples/demo-app/) for a complete Next.js App Router application with a scripted demo:

```bash
cd examples/demo-app
./demo.sh
```

**Demo flow**:
1. Modifies a shared component (`Button.tsx`)
2. Runs `route-impact analyze --working-tree`
3. Shows all affected routes with import chains
4. Expands dynamic routes with configured params
5. Outputs markdown and JSON reports

## CLI Reference

### `route-impact analyze`

```
Options:
  -b, --base <ref>         Base git ref (default: HEAD)
  -h, --head <ref>         Head git ref (default: current branch)
  -w, --working-tree       Analyze working tree changes
  -d, --dir <path>         Next.js project directory
  -o, --output <path>      Output file path
  -f, --format <format>    Output format: json or markdown (default: json)
  -c, --config <path>      Path to route-impact config file
```

### `route-impact verify`

```
Options:
  -b, --base <ref>         Base git ref
  -h, --head <ref>         Head git ref
  --base-url <url>         Base URL for before screenshots (required)
  --head-url <url>         Head URL for after screenshots (required)
  -d, --dir <path>         Next.js project directory
  -o, --output-dir <path>  Output directory (default: route-impact-report)
  -f, --format <format>    Report format: json or markdown (default: markdown)
  -c, --config <path>      Path to route-impact config file
```

## Programmatic API

```typescript
import { RouteImpact } from 'route-impact';

const routeImpact = new RouteImpact({
  baseDir: process.cwd(),
  gitDiff: { base: 'main', head: 'HEAD' },
  dynamicParams: { slug: ['intro', 'advanced'] },
});

// Analyze affected routes
const report = await routeImpact.analyze();
console.log(`Affected routes: ${report.affectedRoutes.length}`);

// Verify with screenshots and metrics
const verificationReport = await routeImpact.verify(
  'http://localhost:3000',
  'http://localhost:3001',
  './report-output'
);

// Generate markdown or JSON
const markdown = routeImpact.generateReport(verificationReport, 'markdown');
```

## Known Limitations (v0.1)

- **Barrel exports**: Deep chains through barrel files (`index.ts` re-exports) may not be fully traced
- **Dynamic imports**: Runtime-only `import()` calls are detected syntactically but not evaluated
- **Monorepos**: Only analyzes the specified `--dir`, not cross-package dependencies
- **CSS-in-JS**: Styled-components, Emotion, and other runtime CSS libraries are not tracked
- **Server Components**: RSC boundaries are not explicitly modeled; all imports are treated equally
- **Incremental Static Regeneration**: No detection of which routes use ISR and need revalidation

## Roadmap

- [ ] Stacked/incremental analysis (only re-analyze changed files since last run)
- [ ] Visual diff of screenshots (pixel-by-pixel comparison)
- [ ] Lighthouse scores in addition to Web Vitals
- [ ] Support for Remix, SvelteKit, and other meta-frameworks
- [ ] MCP server for agent integration
- [ ] Browser extension for PR review

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, testing, and contribution guidelines.

## License

MIT © [Jignesh Dhamecha](https://github.com/djig)

## Related Tools

- [agent-browser](https://github.com/vercel-labs/agent-browser): Browser CLI for agents with React DevTools introspection
- [before-and-after](https://github.com/vercel-labs/before-and-after): Capture before/after screenshots (requires URL list)
- [Playwright](https://playwright.dev/): Browser automation used internally by route-impact
- [axe-core](https://github.com/dequelabs/axe-core): Accessibility testing engine used by route-impact
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp): Performance traces and CrUX data

---

**Status**: Experimental v0.1 (October 2026). Feedback and contributions welcome!
