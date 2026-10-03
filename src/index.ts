import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { RouteAnalyzer } from './route-analyzer.js';
import { GitDiffParser } from './git-diff.js';
import { RouteVerifier } from './verifier.js';
import { Reporter } from './reporter.js';
import type { RouteImpactConfig, RouteImpactReport, AffectedRoute } from './types.js';

export class RouteImpact {
  private config: RouteImpactConfig;
  private analyzer: RouteAnalyzer;
  private gitParser: GitDiffParser;
  private verifier: RouteVerifier;
  private reporter: Reporter;

  constructor(config: RouteImpactConfig) {
    this.config = config;

    const pathAliases = this.loadPathAliases(config.baseDir, config.pathAliases);

    this.analyzer = new RouteAnalyzer(config.baseDir, pathAliases, config.dynamicParams || {});
    this.gitParser = new GitDiffParser(config.baseDir);
    this.verifier = new RouteVerifier();
    this.reporter = new Reporter();
  }

  async analyze(): Promise<RouteImpactReport> {
    const changedFiles = await this.getChangedFiles();

    if (changedFiles.length === 0) {
      return this.emptyReport();
    }

    const affectedRoutes = this.analyzer.analyzeAffectedRoutes(changedFiles);

    const report: RouteImpactReport = {
      timestamp: new Date().toISOString(),
      gitDiff: this.config.gitDiff,
      affectedRoutes,
      summary: this.computeSummary(affectedRoutes),
    };

    return report;
  }

  async verify(baseUrl: string, headUrl: string, outputDir: string): Promise<RouteImpactReport> {
    const report = await this.analyze();

    if (report.affectedRoutes.length === 0) {
      return report;
    }

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const expandedRoutes = this.analyzer.expandDynamicRoutes(report.affectedRoutes);
    const routePaths = expandedRoutes.map(r => r.route);

    const verifications = await this.verifier.verify({
      baseUrl,
      headUrl,
      routes: routePaths,
      outputDir,
    });

    report.verifications = verifications;
    report.summary.verified = verifications.length;

    return report;
  }

  private async getChangedFiles(): Promise<string[]> {
    if (this.config.workingTree) {
      return await this.gitParser.getWorkingTreeChanges();
    }

    if (this.config.gitDiff) {
      return await this.gitParser.getChangedFiles(this.config.gitDiff.base, this.config.gitDiff.head);
    }

    return [];
  }

  private loadPathAliases(baseDir: string, configAliases?: Record<string, string>): Record<string, string> {
    if (configAliases) {
      return configAliases;
    }

    const tsconfigPath = join(baseDir, 'tsconfig.json');
    if (!existsSync(tsconfigPath)) {
      return {};
    }

    try {
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
      const paths = tsconfig.compilerOptions?.paths || {};
      const baseUrl = tsconfig.compilerOptions?.baseUrl || '.';

      const aliases: Record<string, string> = {};
      for (const [alias, targets] of Object.entries(paths)) {
        if (Array.isArray(targets) && targets.length > 0) {
          const cleanAlias = alias.replace(/\/\*$/, '');
          const cleanTarget = (targets[0] as string).replace(/\/\*$/, '');
          aliases[cleanAlias] = join(baseUrl, cleanTarget);
        }
      }

      return aliases;
    } catch (error) {
      console.warn('Failed to load tsconfig.json path aliases:', error);
      return {};
    }
  }

  private computeSummary(routes: AffectedRoute[]) {
    return {
      totalRoutes: routes.length,
      dynamicRoutes: routes.filter(r => r.dynamic).length,
      staticRoutes: routes.filter(r => !r.dynamic).length,
      verified: 0,
    };
  }

  private emptyReport(): RouteImpactReport {
    return {
      timestamp: new Date().toISOString(),
      gitDiff: this.config.gitDiff,
      affectedRoutes: [],
      summary: {
        totalRoutes: 0,
        dynamicRoutes: 0,
        staticRoutes: 0,
        verified: 0,
      },
    };
  }

  generateReport(report: RouteImpactReport, format: 'markdown' | 'json' = 'markdown'): string {
    return format === 'markdown' ? this.reporter.generateMarkdown(report) : this.reporter.generateJson(report);
  }

  writeReport(report: RouteImpactReport, outputPath: string, format: 'markdown' | 'json' = 'markdown'): void {
    this.reporter.writeReport(report, outputPath, format);
  }
}

export * from './types.js';
export { RouteAnalyzer } from './route-analyzer.js';
export { GitDiffParser } from './git-diff.js';
export { RouteVerifier } from './verifier.js';
export { Reporter } from './reporter.js';
