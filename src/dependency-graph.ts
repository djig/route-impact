import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { parse } from '@typescript-eslint/parser';

export interface DependencyNode {
  path: string;
  imports: string[];
  importedBy: Set<string>;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  changedFiles: Set<string>;
}

export class DependencyGraphBuilder {
  private baseDir: string;
  private pathAliases: Record<string, string>;
  private extensions = ['.tsx', '.ts', '.jsx', '.js', '.css', '.scss', '.module.css'];

  constructor(baseDir: string, pathAliases: Record<string, string> = {}) {
    this.baseDir = baseDir;
    this.pathAliases = pathAliases;
  }

  buildGraph(changedFiles: string[]): DependencyGraph {
    const graph: DependencyGraph = {
      nodes: new Map(),
      changedFiles: new Set(changedFiles.map(f => this.normalizePath(f))),
    };

    const visited = new Set<string>();
    const queue: string[] = [...changedFiles];

    while (queue.length > 0) {
      const filePath = queue.shift()!;
      const normalized = this.normalizePath(filePath);

      if (visited.has(normalized)) continue;
      visited.add(normalized);

      const node = this.analyzeFile(normalized);
      if (node) {
        graph.nodes.set(normalized, node);
      }
    }

    this.buildReverseEdges(graph);
    return graph;
  }

  private analyzeFile(filePath: string): DependencyNode | null {
    const absolutePath = resolve(this.baseDir, filePath);
    if (!existsSync(absolutePath)) return null;

    try {
      const content = readFileSync(absolutePath, 'utf-8');
      const imports = this.extractImports(content, filePath);

      return {
        path: filePath,
        imports,
        importedBy: new Set(),
      };
    } catch (error) {
      console.warn(`Failed to analyze ${filePath}:`, error);
      return null;
    }
  }

  private extractImports(content: string, fromFile: string): string[] {
    const imports: string[] = [];

    if (fromFile.endsWith('.css') || fromFile.endsWith('.scss') || fromFile.endsWith('.module.css')) {
      const cssImportRegex = /@import\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = cssImportRegex.exec(content)) !== null) {
        const resolved = this.resolveImport(match[1], fromFile);
        if (resolved) imports.push(resolved);
      }
      return imports;
    }

    try {
      const ast = parse(content, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        range: true,
        loc: true,
        tokens: false,
        comment: false,
      });

      for (const statement of ast.body) {
        if (statement.type === 'ImportDeclaration') {
          const source = (statement as any).source.value;
          if (typeof source === 'string') {
            const resolved = this.resolveImport(source, fromFile);
            if (resolved) imports.push(resolved);
          }
        }
      }

      const dynamicImportRegex = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
      let match;
      while ((match = dynamicImportRegex.exec(content)) !== null) {
        const resolved = this.resolveImport(match[1], fromFile);
        if (resolved) imports.push(resolved);
      }

      const cssImportRegex = /import\s+['"]([^'"]+\.(?:css|scss|module\.css))['"]/g;
      while ((match = cssImportRegex.exec(content)) !== null) {
        const resolved = this.resolveImport(match[1], fromFile);
        if (resolved) imports.push(resolved);
      }
    } catch (_error) {
      const simpleImportRegex = /import\s+(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/g;
      let match;
      while ((match = simpleImportRegex.exec(content)) !== null) {
        const resolved = this.resolveImport(match[1], fromFile);
        if (resolved) imports.push(resolved);
      }
    }

    return [...new Set(imports)];
  }

  private resolveImport(importPath: string, fromFile: string): string | null {
    if (importPath.startsWith('.')) {
      return this.resolveRelativeImport(importPath, fromFile);
    }

    for (const [alias, target] of Object.entries(this.pathAliases)) {
      if (importPath.startsWith(alias)) {
        const replaced = importPath.replace(alias, target);
        return this.resolveAbsoluteImport(replaced);
      }
    }

    if (importPath.startsWith('@/')) {
      const replaced = importPath.replace('@/', '');
      return this.resolveAbsoluteImport(replaced);
    }

    if (!importPath.includes('/') || importPath.startsWith('@')) {
      return null;
    }

    return this.resolveAbsoluteImport(importPath);
  }

  private resolveRelativeImport(importPath: string, fromFile: string): string | null {
    const fromDir = dirname(fromFile);
    const targetPath = join(fromDir, importPath);
    return this.findFileWithExtension(targetPath);
  }

  private resolveAbsoluteImport(importPath: string): string | null {
    return this.findFileWithExtension(importPath);
  }

  private findFileWithExtension(basePath: string): string | null {
    const normalized = basePath.replace(/\\/g, '/');

    for (const ext of this.extensions) {
      const withExt = `${normalized}${ext}`;
      const absolutePath = resolve(this.baseDir, withExt);
      if (existsSync(absolutePath)) {
        return this.normalizePath(withExt);
      }
    }

    const indexTests = [
      `${normalized}/index.tsx`,
      `${normalized}/index.ts`,
      `${normalized}/index.jsx`,
      `${normalized}/index.js`,
    ];

    for (const indexPath of indexTests) {
      const absolutePath = resolve(this.baseDir, indexPath);
      if (existsSync(absolutePath)) {
        return this.normalizePath(indexPath);
      }
    }

    const absolutePath = resolve(this.baseDir, normalized);
    if (existsSync(absolutePath)) {
      return this.normalizePath(normalized);
    }

    return null;
  }

  private buildReverseEdges(graph: DependencyGraph): void {
    for (const [filePath, node] of graph.nodes.entries()) {
      for (const importPath of node.imports) {
        const importedNode = graph.nodes.get(importPath);
        if (importedNode) {
          importedNode.importedBy.add(filePath);
        }
      }
    }
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  findAffectedFiles(graph: DependencyGraph): Set<string> {
    const affected = new Set<string>(graph.changedFiles);
    const queue = [...graph.changedFiles];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = graph.nodes.get(current);
      if (!node) continue;

      for (const parent of node.importedBy) {
        if (!affected.has(parent)) {
          affected.add(parent);
          queue.push(parent);
        }
      }
    }

    return affected;
  }

  getImportChain(graph: DependencyGraph, from: string, to: string): string[] {
    const queue: Array<{ path: string; chain: string[] }> = [{ path: from, chain: [from] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { path, chain } = queue.shift()!;
      if (visited.has(path)) continue;
      visited.add(path);

      if (path === to) return chain;

      const node = graph.nodes.get(path);
      if (!node) continue;

      for (const parent of node.importedBy) {
        queue.push({ path: parent, chain: [...chain, parent] });
      }
    }

    return [];
  }
}
