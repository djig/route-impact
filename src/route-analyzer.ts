import { existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { AffectedRoute, ImportChain } from './types.js';
import type { DependencyGraph } from './dependency-graph.js';
import { DependencyGraphBuilder } from './dependency-graph.js';

export class RouteAnalyzer {
  private baseDir: string;
  private graphBuilder: DependencyGraphBuilder;
  private dynamicParams: Record<string, string[]>;

  constructor(
    baseDir: string,
    pathAliases: Record<string, string> = {},
    dynamicParams: Record<string, string[]> = {}
  ) {
    this.baseDir = baseDir;
    this.graphBuilder = new DependencyGraphBuilder(baseDir, pathAliases);
    this.dynamicParams = dynamicParams;
  }

  analyzeAffectedRoutes(changedFiles: string[]): AffectedRoute[] {
    // Check for global files that affect all routes
    const globalFiles = changedFiles.filter(f => 
      f.includes('middleware.') || 
      f === 'next.config.js' || 
      f === 'next.config.mjs' ||
      f === 'next.config.ts' ||
      f.includes('pages/_app.') ||
      f.includes('pages/_document.')
    );

    // First collect ALL route files in the project
    const allRoutes: AffectedRoute[] = [];
    allRoutes.push(...this.collectAllAppRouterRoutes());
    allRoutes.push(...this.collectAllPagesRouterRoutes());

    // If global files changed, all routes are affected
    if (globalFiles.length > 0) {
      for (const route of allRoutes) {
        route.reason = [{
          file: globalFiles[0],
          importedBy: 'global',
          depth: 0,
        }];
      }
      return this.deduplicateRoutes(allRoutes);
    }

    // Build dependency graph starting from ALL route files, not just changed files
    // This ensures we can trace dependencies properly
    const allRouteFiles = allRoutes.map(r => r.path);
    const changedFilesSet = new Set(changedFiles);
    const graph = this.graphBuilder.buildGraph([...changedFiles, ...allRouteFiles]);
    const affectedFiles = this.graphBuilder.findAffectedFiles(graph);

    // Filter routes to only those whose files are in the affected set OR are directly changed
    const affectedRoutes = allRoutes.filter(route => 
      affectedFiles.has(route.path) || changedFilesSet.has(route.path)
    );

    // Add import chain information
    for (const route of affectedRoutes) {
      route.reason = this.buildImportChainToChangedFile(graph, route.path, changedFiles);
    }

    return this.deduplicateRoutes(affectedRoutes);
  }

  private collectAllAppRouterRoutes(): AffectedRoute[] {
    const appDir = join(this.baseDir, 'app');
    const srcAppDir = join(this.baseDir, 'src', 'app');

    const baseAppDir = existsSync(appDir) ? appDir : existsSync(srcAppDir) ? srcAppDir : null;
    if (!baseAppDir) return [];

    return this.collectAllAppRoutes(baseAppDir, '');
  }

  private collectAllAppRoutes(baseDir: string, currentPath: string): AffectedRoute[] {
    const routes: AffectedRoute[] = [];
    const fullPath = join(baseDir, currentPath);

    if (!existsSync(fullPath)) return routes;

    const entries = readdirSync(fullPath);
    const routePath = currentPath.replace(/\\/g, '/');
    const route = this.normalizeAppRoute(routePath);

    for (const entry of entries) {
      const entryPath = join(fullPath, entry);
      const stat = statSync(entryPath);

      if (stat.isDirectory()) {
        if (entry.startsWith('_') || entry.startsWith('.')) continue;
        routes.push(...this.collectAllAppRoutes(baseDir, join(currentPath, entry)));
      } else {
        let type: AffectedRoute['type'] | null = null;
        if (entry === 'page.tsx' || entry === 'page.ts' || entry === 'page.jsx' || entry === 'page.js') {
          type = 'page';
        } else if (entry === 'layout.tsx' || entry === 'layout.ts' || entry === 'layout.jsx' || entry === 'layout.js') {
          type = 'layout';
        } else if (entry === 'template.tsx' || entry === 'template.ts' || entry === 'template.jsx' || entry === 'template.js') {
          type = 'template';
        } else if (entry === 'loading.tsx' || entry === 'loading.ts' || entry === 'loading.jsx' || entry === 'loading.js') {
          type = 'loading';
        } else if (entry === 'error.tsx' || entry === 'error.ts' || entry === 'error.jsx' || entry === 'error.js') {
          type = 'error';
        } else if (entry === 'not-found.tsx' || entry === 'not-found.ts' || entry === 'not-found.jsx' || entry === 'not-found.js') {
          type = 'error';
        } else if (entry === 'route.ts' || entry === 'route.js') {
          type = 'route';
        }

        if (type) {
          routes.push({
            route,
            path: relative(this.baseDir, entryPath).replace(/\\/g, '/'),
            type,
            reason: [],
            dynamic: route.includes('['),
            params: this.extractDynamicParams(route),
          });
        }
      }
    }

    return routes;
  }


  private normalizeAppRoute(routePath: string): string {
    const segments = routePath.split('/').filter(Boolean);
    const normalized = segments
      .filter(seg => !seg.startsWith('(') || !seg.endsWith(')'))
      .map(seg => {
        if (seg.startsWith('[...') && seg.endsWith(']')) {
          return `[...${seg.slice(4, -1)}]`;
        }
        if (seg.startsWith('[') && seg.endsWith(']')) {
          return `[${seg.slice(1, -1)}]`;
        }
        if (seg.startsWith('[[...') && seg.endsWith(']]')) {
          return `[[...${seg.slice(5, -2)}]]`;
        }
        if (seg.startsWith('@')) {
          return null;
        }
        return seg;
      })
      .filter(Boolean);

    return '/' + normalized.join('/');
  }

  private collectAllPagesRouterRoutes(): AffectedRoute[] {
    const pagesDir = join(this.baseDir, 'pages');
    const srcPagesDir = join(this.baseDir, 'src', 'pages');

    const basePagesDir = existsSync(pagesDir) ? pagesDir : existsSync(srcPagesDir) ? srcPagesDir : null;
    if (!basePagesDir) return [];

    return this.collectAllPagesRoutes(basePagesDir);
  }

  private collectAllPagesRoutes(baseDir: string): AffectedRoute[] {
    const routes: AffectedRoute[] = [];
    if (!existsSync(baseDir)) return routes;

    const scanDirectory = (dir: string) => {
      const entries = readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        const relativePath = relative(baseDir, fullPath).replace(/\\/g, '/');

        if (stat.isDirectory()) {
          if (entry.startsWith('_') || entry === 'api') continue;
          scanDirectory(fullPath);
        } else if (entry.match(/\.(tsx?|jsx?)$/)) {
          if (entry.startsWith('_')) {
            // Special files like _app, _document
            routes.push({
              route: '/',
              path: relative(this.baseDir, fullPath).replace(/\\/g, '/'),
              type: 'page',
              reason: [],
              dynamic: false,
            });
            continue;
          }

          const route = this.buildPagesRoute(relativePath);
          if (route) {
            routes.push({
              route,
              path: relative(this.baseDir, fullPath).replace(/\\/g, '/'),
              type: 'page',
              reason: [],
              dynamic: route.includes('['),
              params: this.extractDynamicParams(route),
            });
          }
        }
      }
    };

    scanDirectory(baseDir);
    return routes;
  }

  private buildPagesRoute(relativePath: string): string | null {
    let route = relativePath.replace(/\.(tsx?|jsx?)$/, '');

    if (route === 'index') return '/';
    if (route.endsWith('/index')) {
      route = route.slice(0, -6);
    }

    const segments = route.split('/');
    const normalized = segments.map(seg => {
      if (seg.startsWith('[...') && seg.endsWith(']')) {
        return `[...${seg.slice(4, -1)}]`;
      }
      if (seg.startsWith('[') && seg.endsWith(']')) {
        return `[${seg.slice(1, -1)}]`;
      }
      return seg;
    });

    return '/' + normalized.join('/');
  }

  private extractDynamicParams(route: string): string[] | undefined {
    const params: string[] = [];
    const regex = /\[\.\.\.(\w+)\]|\[(\w+)\]/g;
    let match;

    while ((match = regex.exec(route)) !== null) {
      params.push(match[1] || match[2]);
    }

    return params.length > 0 ? params : undefined;
  }

  private buildImportChainToChangedFile(
    graph: DependencyGraph,
    routeFile: string,
    changedFiles: string[]
  ): ImportChain[] {
    const changedSet = new Set(changedFiles);
    
    // BFS to find shortest path from route to any changed file
    const queue: Array<{ file: string; chain: ImportChain[] }> = [{ file: routeFile, chain: [] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { file, chain } = queue.shift()!;
      if (visited.has(file)) continue;
      visited.add(file);

      // Check if this file is a changed file
      if (changedSet.has(file) && chain.length > 0) {
        return chain;
      }

      const node = graph.nodes.get(file);
      if (!node) continue;

      // Explore imports (things this file depends on)
      for (const importPath of node.imports) {
        if (!visited.has(importPath)) {
          const newChain = [
            ...chain,
            {
              file: importPath,
              importedBy: file,
              depth: chain.length,
            },
          ];

          // If we found a changed file, return immediately
          if (changedSet.has(importPath)) {
            return newChain;
          }

          queue.push({ file: importPath, chain: newChain });
        }
      }
    }

    return [];
  }

  private deduplicateRoutes(routes: AffectedRoute[]): AffectedRoute[] {
    const seen = new Map<string, AffectedRoute>();

    for (const route of routes) {
      // Use path as key to avoid colliding routes (e.g. app/error.tsx and app/not-found.tsx both have route='/' and type='error')
      const key = route.path;
      const existing = seen.get(key);

      if (!existing || route.reason.length < existing.reason.length) {
        seen.set(key, route);
      }
    }

    return Array.from(seen.values()).sort((a, b) => a.route.localeCompare(b.route));
  }

  expandDynamicRoutes(routes: AffectedRoute[]): AffectedRoute[] {
    const expanded: AffectedRoute[] = [];

    for (const route of routes) {
      if (!route.dynamic || !route.params) {
        expanded.push(route);
        continue;
      }

      const paramCombinations = this.getParamCombinations(route.route, route.params);
      if (paramCombinations.length === 0) {
        expanded.push(route);
        continue;
      }

      for (const params of paramCombinations) {
        let expandedRoute = route.route;
        for (const [key, value] of Object.entries(params)) {
          expandedRoute = expandedRoute.replace(`[${key}]`, value).replace(`[...${key}]`, value);
        }

        expanded.push({
          ...route,
          route: expandedRoute,
          dynamic: false,
        });
      }
    }

    return expanded;
  }

  private getParamCombinations(route: string, params: string[]): Array<Record<string, string>> {
    const combinations: Array<Record<string, string>> = [];

    for (const param of params) {
      const values = this.dynamicParams[param] || this.dynamicParams[route];
      if (values && values.length > 0) {
        if (combinations.length === 0) {
          for (const value of values) {
            combinations.push({ [param]: value });
          }
        } else {
          const newCombinations: Array<Record<string, string>> = [];
          for (const combo of combinations) {
            for (const value of values) {
              newCombinations.push({ ...combo, [param]: value });
            }
          }
          combinations.length = 0;
          combinations.push(...newCombinations);
        }
      }
    }

    return combinations;
  }
}
