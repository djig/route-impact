# Route Impact Analysis for Next.js

## Skill Metadata
- **ID**: `route-impact`
- **Name**: Route Impact Analysis
- **Description**: Compute which Next.js routes are affected by code changes and verify them with before/after screenshots
- **Version**: 0.1.0
- **Tags**: nextjs, testing, verification, routes, accessibility, web-vitals

## When to Use This Skill

Use this skill after making changes to a Next.js application, especially when:

1. You've modified shared components, hooks, or utilities
2. You've changed layouts, templates, or page components
3. You've updated global styles or configuration
4. You've modified middleware or routing logic
5. The user asks you to verify which routes are affected by changes

This skill helps you understand the **blast radius** of your changes and verify that affected routes still work correctly.

## Prerequisites

- A Next.js project (App Router and/or Pages Router)
- Node.js 18+ installed
- The `route-impact` CLI tool installed: `npm install -g route-impact`

## Usage

### 1. Analyze Affected Routes

After making code changes, run route-impact to see which routes are affected:

```bash
# Analyze working tree changes
route-impact analyze --working-tree --format markdown --output routes.md

# Analyze a git diff between branches
route-impact analyze --base main --head feature-branch --format json --output routes.json
```

This outputs:
- A list of all affected routes
- Why each route is affected (import chain from changed files)
- Which routes are dynamic and need parameters

### 2. Verify Routes with Before/After Testing

To capture screenshots and run accessibility/performance checks:

```bash
# First, ensure you have base and head versions running
# Base (before): http://localhost:3000
# Head (after): http://localhost:3001

route-impact verify \
  --base main \
  --head HEAD \
  --base-url http://localhost:3000 \
  --head-url http://localhost:3001 \
  --output-dir verification-report
```

This produces:
- Before/after screenshots of each affected route
- Accessibility scan results (powered by axe-core)
- Web Vitals metrics (LCP, FID, CLS, FCP, TTFB)
- A markdown report showing what changed

### 3. Configure Dynamic Route Parameters

For dynamic routes like `/blog/[slug]`, create a config file:

**route-impact.config.json**:
```json
{
  "dynamicParams": {
    "slug": ["intro", "getting-started", "advanced"],
    "id": ["1", "2", "3"]
  }
}
```

Then run with `--config route-impact.config.json`.

### 4. In CI (GitHub Actions)

Add this to your workflow:

```yaml
- name: Analyze Route Impact
  uses: route-impact@v0.1
  with:
    base-ref: ${{ github.event.pull_request.base.sha }}
    head-ref: ${{ github.event.pull_request.head.sha }}
    analyze-only: 'true'
    post-comment: 'true'
```

## Recommended Workflow for Agents

1. **After making frontend changes**, run `route-impact analyze --working-tree` to see which routes are affected.

2. **Review the import chain** to understand why each route is affected. If a route appears that shouldn't be affected, check for unintended dependencies.

3. **For critical changes** (shared components, layouts, auth guards), consider running the full verification with before/after screenshots:
   - Start the base version on one port
   - Start the head version on another port
   - Run `route-impact verify`
   - Review the report for:
     - New accessibility violations (should be zero)
     - Web Vitals regressions (watch for >10% increases in LCP/FID)
     - Visual differences in screenshots

4. **For pull requests**, mention in your description:
   - How many routes were affected
   - Whether you verified them
   - Any accessibility or performance concerns

## Example Output

**Analyze output (markdown)**:

```markdown
# Route Impact Report

**Generated:** 2026-10-03 10:30:45

**Base:** `main`
**Head:** `feature-branch`

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
    ↳ `components/Button.tsx`

### /blog
- **Type:** page
- **File:** `app/blog/page.tsx`

**Import Chain:**
  ↳ `components/Header.tsx`
    ↳ `components/Button.tsx`

### /blog/[slug]
- **Type:** page
- **File:** `app/blog/[slug]/page.tsx`
- **Dynamic Params:** `slug`

**Import Chain:**
  ↳ `components/Header.tsx`
    ↳ `components/Button.tsx`
```

## Tips

- **Fast feedback loop**: Use `--working-tree` during development to see affected routes instantly
- **Dynamic routes**: Always configure sample parameters in `route-impact.config.json` for proper verification
- **Path aliases**: route-impact reads `tsconfig.json` automatically to resolve path aliases like `@/components`
- **Large changes**: If a middleware or `next.config.js` file changes, expect all routes to be affected
- **Performance**: The analyze step is fast (< 1s for most projects); verification takes longer due to browser automation

## Common Issues

1. **No routes found**: Check that you're in a Next.js project with an `app/` or `pages/` directory
2. **Wrong routes flagged**: Verify your `tsconfig.json` path aliases are correct
3. **Dynamic routes not verified**: Add parameters to `route-impact.config.json`
4. **Screenshots failing**: Ensure the URLs are accessible and the servers are running

## Related Tools

- **agent-browser**: For more advanced browser testing and React DevTools introspection
- **Playwright**: route-impact uses Playwright internally; you can write custom tests for complex scenarios
- **axe-core**: route-impact runs axe scans automatically; review violations in the report

## Next.js Version Support

- **App Router** (Next.js 13+): Full support for pages, layouts, templates, loading, error, and route handlers
- **Pages Router** (Next.js 12 and earlier): Supported
- **Hybrid** (both routers): Supported

## Learn More

- GitHub: https://github.com/djig/route-impact
- npm: https://www.npmjs.com/package/route-impact
- Issues: https://github.com/djig/route-impact/issues
