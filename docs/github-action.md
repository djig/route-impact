# GitHub Action

## Usage

```yaml
name: Route Impact

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  route-impact:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for git diff
      
      - uses: djig/route-impact@v0.1
        with:
          base: ${{ github.event.pull_request.base.ref }}
          head: ${{ github.event.pull_request.head.ref }}
          post-comment: 'true'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `base` | Base git ref | No | `main` |
| `head` | Head git ref | No | `HEAD` |
| `format` | Output format (`json`, `markdown`) | No | `markdown` |
| `analyze-only` | Skip verification | No | `true` |
| `post-comment` | Post as PR comment | No | `false` |
| `github-token` | Token for PR comments | No | `${{ github.token }}` |
| `base-url` | Base URL for verification | No | - |
| `head-url` | Head URL for verification | No | - |

## Outputs

| Output | Description |
|--------|-------------|
| `affected-routes-count` | Number of affected routes |
| `report-path` | Path to generated report |

## Examples

### Analyze Only (No Verification)

```yaml
- uses: djig/route-impact@v0.1
  with:
    analyze-only: 'true'
```

### With Verification

Requires running dev servers.

```yaml
- uses: actions/setup-node@v4
- run: npm ci

# Start base version
- name: Start Base Server
  run: |
    git checkout ${{ github.base_ref }}
    npm run build
    npm start &
    sleep 5

# Start head version on different port
- name: Start Head Server  
  run: |
    git checkout ${{ github.head_ref }}
    PORT=3001 npm start &
    sleep 5

- uses: djig/route-impact@v0.1
  with:
    base-url: http://localhost:3000
    head-url: http://localhost:3001
    post-comment: 'true'
```

### Custom Config

```yaml
- uses: djig/route-impact@v0.1
  with:
    config: route-impact.config.json
```

## PR Comment Format

The action posts a comment like:

```markdown
## 🎯 Route Impact Analysis

**Affected Routes:** 3

### Routes
- `/blog` - via `components/Header.tsx`
- `/blog/[slug]` - via `components/Header.tsx`
- `/about` - via `app/about/page.tsx` (direct)

<details>
<summary>Full Report</summary>

[Detailed markdown report]

</details>
```
