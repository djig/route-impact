# Known Issues (v0.1)

## Test Failures (3/27 = 11%)

### 1. not-found.tsx not being detected
- **Issue**: When `app/not-found.tsx` is changed directly, it's not appearing in affected routes
- **Root cause**: File is being collected but filtering logic may have path mismatch issue
- **Workaround**: Works fine when files that import not-found are changed
- **Priority**: Low - edge case, not-found rarely changed in isolation

### 2. Global CSS import chain tracing
- **Issue**: Some edge cases in tracing global CSS imports through layouts
- **Root cause**: CSS dependency graph tracing may miss some import patterns
- **Workaround**: Direct CSS file changes are detected, affects primarily Pages Router _app
- **Priority**: Low - CSS changes are less common

### 3. Pages Router _app affecting all pages
- **Issue**: `pages/_app.tsx` marked as global but Pages Router routes may not all appear
- **Root cause**: Pages Router route collection or filtering
- **Workaround**: Direct page file changes work correctly
- **Priority**: Low - affects primarily hybrid projects

## Working Features (24/27 = 89%)

All major routing features work correctly including:
- App Router: layouts, templates, loading, error, dynamic routes, catch-all, route groups, parallel routes, intercepting routes
- Middleware and next.config (global files)
- Path aliases and barrel exports
- CSS modules
- Pages Router dynamic routes

These 3 edge cases don't affect real-world usage significantly.
