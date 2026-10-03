# Route Impact Report

**Generated:** 10/3/2026, 6:06:17 PM

**Base:** `master`
**Head:** `feature/update-pages`

## Summary

- **Total Routes Affected:** 2
- **Static Routes:** 1
- **Dynamic Routes:** 1
## Affected Routes

### /blog
- **Type:** page
- **File:** `app/blog/page.tsx`

**Import Chain:**

    ↳ `components/Header.tsx`

### /blog/[slug]
- **Type:** page
- **File:** `app/blog/[slug]/page.tsx`
- **Dynamic Params:** `slug`

**Import Chain:**

    ↳ `components/Header.tsx`
