# API Reference

## RouteImpact

Main entry point for programmatic usage.

```typescript
import { RouteImpact } from 'route-impact';
```

### Constructor

```typescript
constructor(config: RouteImpactConfig)
```

#### Config Options

```typescript
interface RouteImpactConfig {
  baseDir: string;               // Project root
  gitDiff?: {
    base: string;                // Base git ref
    head: string;                // Head git ref
  };
  workingTree?: boolean;         // Analyze working tree
  dynamicParams?: Record<string, string[]>;  // Route param values
}
```

### Methods

#### `analyze(): Promise<RouteImpactReport>`

Analyzes affected routes.

```typescript
const report = await impact.analyze();

console.log(`Affected: ${report.affectedRoutes.length}`);
report.affectedRoutes.forEach(route => {
  console.log(route.route, route.path);
  route.reason.forEach(r => console.log('  ↳', r.file));
});
```

#### `verify(baseUrl, headUrl, outputDir): Promise<VerificationResult>`

Runs verification with screenshots, axe, and Web Vitals.

```typescript
const result = await impact.verify(
  'http://localhost:3000',
  'http://localhost:3001',
  './verification-report'
);

result.routes.forEach(route => {
  console.log(route.route);
  console.log('  Axe:', route.head.axe?.violations.length, 'violations');
  console.log('  LCP:', route.head.webVitals?.lcp);
});
```

## RouteAnalyzer

Low-level route analysis (used internally by RouteImpact).

```typescript
import { RouteAnalyzer } from 'route-impact';

const analyzer = new RouteAnalyzer('/path/to/project');
const routes = analyzer.analyzeAffectedRoutes(['changed-file.tsx']);
```

## Types

### AffectedRoute

```typescript
interface AffectedRoute {
  route: string;          // /blog/[slug]
  path: string;           // app/blog/[slug]/page.tsx
  type: 'page' | 'layout' | 'template' | 'loading' | 'error' | 'route';
  reason: ImportChain[];
  dynamic: boolean;
  params?: string[];      // ['slug']
}
```

### ImportChain

```typescript
interface ImportChain {
  file: string;
  importedBy: string;
  depth: number;
}
```

### VerificationResult

```typescript
interface VerificationResult {
  baseCommit: string;
  headCommit: string;
  timestamp: string;
  routes: VerificationDiff[];
}
```

### VerificationDiff

```typescript
interface VerificationDiff {
  route: string;
  base: {
    screenshot: string;
    axe?: AxeViolation[];
    webVitals?: WebVitalsMetrics;
  };
  head: {
    screenshot: string;
    axe?: AxeViolation[];
    webVitals?: WebVitalsMetrics;
  };
}
```

## DependencyGraph

Internal module for building import graphs.

```typescript
const builder = new DependencyGraphBuilder(baseDir);
const graph = builder.buildGraph(entryFiles);
const affected = builder.findAffectedFiles(graph);
```
