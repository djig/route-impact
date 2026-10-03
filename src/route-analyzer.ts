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
    const graph = this.graphBuilder.buildGraph(changedFiles);
    const affectedFiles = this.graphBuilder.findAffectedFiles(graph);

    const routes: AffectedRoute[] = [];

    routes.push(...this.findAppRouterRoutes(affectedFiles, graph));
    routes.push(...this.findPagesRouterRoutes(affectedFiles, graph));

    return this.deduplicateRoutes(routes);
  }

  private findAppRouterRoutes(affectedFiles: Set<string>, graph: DependencyGraph): AffectedRoute[] {
    const routes: AffectedRoute[] = [];
    const appDir = join(this.baseDir, 'app');
    const srcAppDir = join(this.baseDir, 'src', 'app');

    const baseAppDir = existsSync(appDir) ? appDir : existsSync(srcAppDir) ? srcAppDir : null;
    if (!baseAppDir) return routes;

    const globalFiles = new Set<string>();
    for (const file of affectedFiles) {
      if (file.includes('middleware.') || file === 'next.config.js' || file === 'next.config.mjs') {
        globalFiles.add(file);
      }
    }

    if (globalFiles.size > 0) {
      this.collectAllAppRoutes(baseAppDir, '').forEach(route => {
        routes.push({
          ...route,
          reason: this.buildImportChain(graph, [...globalFiles][0], route.path),
        });
      });
      return routes;
    }

    for (const file of affectedFiles) {
      const normalizedFile = file.replace(/\\/g, '/');
      if (!normalizedFile.includes('/app/') && !normalizedFile.startsWith('app/')) continue;

      const routeSegments = this.extractRouteSegments(normalizedFile, baseAppDir);
      if (!routeSegments) continue;

      const route = this.buildAppRoute(routeSegments, file, graph);
      if (route) routes.push(route);
    }

    return routes;
  }

  private collectAllAppRoutes(baseDir: string, currentPath: string): AffectedRoute[] {
    const routes: AffectedRoute[] = [];
    const fullPath = join(baseDir, currentPath);

    if (!existsSync(fullPath)) return routes;

    const entries = readdirSync(fullPath);

    for (const entry of entries) {
      const entryPath = join(fullPath, entry);
      const stat = statSync(entryPath);

      if (stat.isDirectory()) {
        if (entry.startsWith('_') || entry.startsWith('.')) continue;
        routes.push(...this.collectAllAppRoutes(baseDir, join(currentPath, entry)));
      } else if (entry === 'page.tsx' || entry === 'page.ts' || entry === 'page.jsx' || entry === 'page.js') {
        const routePath = currentPath.replace(/\\/g, '/');
        const route = this.normalizeAppRoute(routePath);
        routes.push({
          route,
          path: relative(this.baseDir, entryPath).replace(/\\/g, '/'),
          type: 'page',
          reason: [],
          dynamic: route.includes('['),
          params: this.extractDynamicParams(route),
        });
      }
    }

    return routes;
  }

  private extractRouteSegments(filePath: string, baseAppDir: string): string | null {
    const relativePath = relative(baseAppDir, join(this.baseDir, filePath)).replace(/\\/g, '/');
    if (relativePath.startsWith('..')) return null;

    const segments = relativePath.split('/').slice(0, -1);
    return segments.join('/');
  }

  private buildAppRoute(routeSegments: string, filePath: string, graph: DependencyGraph): AffectedRoute | null {
    const route = this.normalizeAppRoute(routeSegments);
    const fileName = filePath.split('/').pop() || '';

    let type: AffectedRoute['type'] = 'page';
    if (fileName.startsWith('layout.')) type = 'layout';
    else if (fileName.startsWith('template.')) type = 'template';
    else if (fileName.startsWith('loading.')) type = 'loading';
    else if (fileName.startsWith('error.')) type = 'error';
    else if (fileName.startsWith('route.')) type = 'route';
    else if (!fileName.startsWith('page.')) return null;

    return {
      route,
      path: filePath,
      type,
      reason: this.buildImportChain(graph, filePath, filePath),
      dynamic: route.includes('['),
      params: this.extractDynamicParams(route),
    };
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

  private findPagesRouterRoutes(affectedFiles: Set<string>, graph: DependencyGraph): AffectedRoute[] {
    const routes: AffectedRoute[] = [];
    const pagesDir = join(this.baseDir, 'pages');
    const srcPagesDir = join(this.baseDir, 'src', 'pages');

    const basePagesDir = existsSync(pagesDir) ? pagesDir : existsSync(srcPagesDir) ? srcPagesDir : null;
    if (!basePagesDir) return routes;

    for (const file of affectedFiles) {
      const normalizedFile = file.replace(/\\/g, '/');
      if (!normalizedFile.includes('/pages/') && !normalizedFile.startsWith('pages/')) continue;

      const relativePath = relative(basePagesDir, join(this.baseDir, file)).replace(/\\/g, '/');
      if (relativePath.startsWith('..') || relativePath.startsWith('_') || relativePath.startsWith('api/')) continue;

      const route = this.buildPagesRoute(relativePath);
      if (route) {
        routes.push({
          route,
          path: file,
          type: 'page',
          reason: this.buildImportChain(graph, file, file),
          dynamic: route.includes('['),
          params: this.extractDynamicParams(route),
        });
      }
    }

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

  private buildImportChain(graph: DependencyGraph, startFile: string, _endFile: string): ImportChain[] {
    const chain: ImportChain[] = [];
    const visited = new Set<string>();
    const queue: Array<{ file: string; depth: number; parent: string | null }> = [
      { file: startFile, depth: 0, parent: null },
    ];

    while (queue.length > 0) {
      const { file, depth, parent } = queue.shift()!;
      if (visited.has(file)) continue;
      visited.add(file);

      if (parent) {
        chain.push({
          file,
          importedBy: parent,
          depth,
        });
      }

      if (graph.changedFiles.has(file) && depth > 0) {
        break;
      }

      const node = graph.nodes.get(file);
      if (node) {
        for (const importPath of node.imports) {
          if (graph.changedFiles.has(importPath)) {
            chain.push({
              file: importPath,
              importedBy: file,
              depth: depth + 1,
            });
            return chain;
          }
          if (!visited.has(importPath)) {
            queue.push({ file: importPath, depth: depth + 1, parent: file });
          }
        }
      }
    }

    return chain;
  }

  private deduplicateRoutes(routes: AffectedRoute[]): AffectedRoute[] {
    const seen = new Map<string, AffectedRoute>();

    for (const route of routes) {
      const key = `${route.route}:${route.type}`;
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
