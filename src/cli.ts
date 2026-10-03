#!/usr/bin/env node

import { Command } from 'commander';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { RouteImpact } from './index.js';
import pc from 'picocolors';

const program = new Command();

program
  .name('route-impact')
  .description('Compute affected Next.js routes from git diffs and verify them')
  .version('0.1.0');

program
  .command('analyze')
  .description('Analyze affected routes from a git diff')
  .option('-b, --base <ref>', 'Base git ref (default: HEAD)')
  .option('-h, --head <ref>', 'Head git ref (default: current branch)')
  .option('-w, --working-tree', 'Analyze working tree changes instead of git diff')
  .option('-d, --dir <path>', 'Next.js project directory', process.cwd())
  .option('-o, --output <path>', 'Output file path (default: route-impact.json)')
  .option('-f, --format <format>', 'Output format: json or markdown', 'json')
  .option('-c, --config <path>', 'Path to route-impact config file')
  .action(async options => {
    try {
      const baseDir = resolve(options.dir);
      const config = loadConfig(baseDir, options.config);

      const routeImpact = new RouteImpact({
        baseDir,
        gitDiff: options.workingTree
          ? undefined
          : {
              base: options.base || 'HEAD',
              head: options.head || 'HEAD',
            },
        workingTree: options.workingTree,
        dynamicParams: config.dynamicParams,
        pathAliases: config.pathAliases,
      });

      console.log(pc.blue('Analyzing affected routes...\n'));

      const report = await routeImpact.analyze();

      console.log(pc.green(`✓ Found ${report.summary.totalRoutes} affected route(s)\n`));

      if (report.affectedRoutes.length > 0) {
        console.log(pc.bold('Affected Routes:'));
        for (const route of report.affectedRoutes) {
          const icon = route.dynamic ? '🔗' : '📄';
          console.log(`  ${icon} ${pc.cyan(route.route)} ${pc.dim(`(${route.type})`)}`);
          if (route.reason.length > 0) {
            const changed = route.reason.find(r => r.depth > 0);
            if (changed) {
              console.log(`     ${pc.dim(`← changed: ${changed.file}`)}`);
            }
          }
        }
        console.log('');
      }

      const outputPath = resolve(options.output || 'route-impact.json');
      routeImpact.writeReport(report, outputPath, options.format);

      console.log(pc.green(`✓ Report written to ${pc.bold(outputPath)}`));
    } catch (error) {
      console.error(pc.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('verify')
  .description('Verify affected routes with before/after screenshots and metrics')
  .option('-b, --base <ref>', 'Base git ref (default: HEAD)')
  .option('-h, --head <ref>', 'Head git ref (default: current branch)')
  .option('--base-url <url>', 'Base URL for before screenshots (required)', '')
  .option('--head-url <url>', 'Head URL for after screenshots (required)', '')
  .option('-d, --dir <path>', 'Next.js project directory', process.cwd())
  .option('-o, --output-dir <path>', 'Output directory for screenshots and reports', 'route-impact-report')
  .option('-f, --format <format>', 'Report format: json or markdown', 'markdown')
  .option('-c, --config <path>', 'Path to route-impact config file')
  .action(async options => {
    try {
      if (!options.baseUrl || !options.headUrl) {
        console.error(pc.red('Error: --base-url and --head-url are required'));
        process.exit(1);
      }

      const baseDir = resolve(options.dir);
      const config = loadConfig(baseDir, options.config);

      const routeImpact = new RouteImpact({
        baseDir,
        gitDiff: {
          base: options.base || 'HEAD',
          head: options.head || 'HEAD',
        },
        dynamicParams: config.dynamicParams,
        pathAliases: config.pathAliases,
      });

      console.log(pc.blue('Analyzing affected routes...\n'));

      const outputDir = resolve(options.outputDir);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const report = await routeImpact.verify(options.baseUrl, options.headUrl, outputDir);

      console.log(pc.green(`✓ Verified ${report.summary.verified} route(s)\n`));

      if (report.verifications && report.verifications.length > 0) {
        console.log(pc.bold('Verification Summary:'));
        for (const verification of report.verifications) {
          console.log(`\n  ${pc.cyan(verification.route)}`);

          if (verification.before.error) {
            console.log(`    Before: ${pc.red(verification.before.error)}`);
          }
          if (verification.after.error) {
            console.log(`    After: ${pc.red(verification.after.error)}`);
          }

          const diff = verification.diff;
          if (diff.axeViolationsAdded.length > 0) {
            console.log(`    ${pc.yellow('⚠')} New a11y violations: ${diff.axeViolationsAdded.length}`);
          }
          if (diff.axeViolationsRemoved.length > 0) {
            console.log(`    ${pc.green('✓')} Fixed a11y violations: ${diff.axeViolationsRemoved.length}`);
          }
          if (diff.webVitalsRegression) {
            console.log(`    ${pc.red('⚠')} Web Vitals regression detected`);
          }
        }
        console.log('');
      }

      const reportPath = join(outputDir, `report.${options.format === 'json' ? 'json' : 'md'}`);
      routeImpact.writeReport(report, reportPath, options.format);

      console.log(pc.green(`✓ Full report written to ${pc.bold(reportPath)}`));
      console.log(pc.dim(`  Screenshots saved to ${outputDir}/`));
    } catch (error) {
      console.error(pc.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

function loadConfig(baseDir: string, configPath?: string): any {
  const paths = [
    configPath,
    join(baseDir, 'route-impact.config.json'),
    join(baseDir, '.route-impact.json'),
  ].filter(Boolean);

  for (const path of paths) {
    if (path && existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, 'utf-8'));
      } catch (_error) {
        console.warn(pc.yellow(`Warning: Failed to load config from ${path}`));
      }
    }
  }

  return {};
}

program.parse();
