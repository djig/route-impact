import { writeFileSync } from 'fs';
import type { RouteImpactReport } from './types.js';

export class Reporter {
  generateMarkdown(report: RouteImpactReport): string {
    const lines: string[] = [];

    lines.push('# Route Impact Report\n');
    lines.push(`**Generated:** ${new Date(report.timestamp).toLocaleString()}\n`);

    if (report.gitDiff) {
      lines.push(`**Base:** \`${report.gitDiff.base}\``);
      lines.push(`**Head:** \`${report.gitDiff.head}\`\n`);
    }

    lines.push('## Summary\n');
    lines.push(`- **Total Routes Affected:** ${report.summary.totalRoutes}`);
    lines.push(`- **Static Routes:** ${report.summary.staticRoutes}`);
    lines.push(`- **Dynamic Routes:** ${report.summary.dynamicRoutes}`);
    if (report.verifications) {
      lines.push(`- **Routes Verified:** ${report.summary.verified}\n`);
    }

    if (report.affectedRoutes.length > 0) {
      lines.push('## Affected Routes\n');

      for (const route of report.affectedRoutes) {
        lines.push(`### ${route.route}`);
        lines.push(`- **Type:** ${route.type}`);
        lines.push(`- **File:** \`${route.path}\``);
        if (route.dynamic && route.params) {
          lines.push(`- **Dynamic Params:** ${route.params.map(p => `\`${p}\``).join(', ')}`);
        }

        if (route.reason.length > 0) {
          lines.push('\n**Import Chain:**\n');
          const chain = route.reason.map(r => `  ${'  '.repeat(r.depth)}↳ \`${r.file}\``).join('\n');
          lines.push(chain);
        }

        lines.push('');
      }
    }

    if (report.verifications && report.verifications.length > 0) {
      lines.push('## Verification Results\n');

      for (const verification of report.verifications) {
        lines.push(`### ${verification.route}\n`);

        lines.push('#### Before');
        lines.push(this.formatScreenshotResult(verification.before));

        lines.push('#### After');
        lines.push(this.formatScreenshotResult(verification.after));

        lines.push('#### Changes');
        const diff = verification.diff;

        if (diff.axeViolationsAdded.length > 0) {
          lines.push('\n**New Accessibility Violations:**\n');
          for (const violation of diff.axeViolationsAdded) {
            lines.push(`- [${violation.impact}] ${violation.description} (${violation.nodes} nodes)`);
          }
        }

        if (diff.axeViolationsRemoved.length > 0) {
          lines.push('\n**Fixed Accessibility Violations:**\n');
          for (const violation of diff.axeViolationsRemoved) {
            lines.push(`- [${violation.impact}] ${violation.description} (${violation.nodes} nodes)`);
          }
        }

        if (diff.webVitalsRegression) {
          lines.push('\n**Web Vitals Regressions:**\n');
          for (const [metric, delta] of Object.entries(diff.vitalsDeltas)) {
            if (delta > 0) {
              lines.push(`- ${metric}: +${delta.toFixed(2)}ms`);
            }
          }
        }

        if (Object.keys(diff.vitalsDeltas).length > 0 && !diff.webVitalsRegression) {
          lines.push('\n**Web Vitals Improvements:**\n');
          for (const [metric, delta] of Object.entries(diff.vitalsDeltas)) {
            if (delta < 0) {
              lines.push(`- ${metric}: ${delta.toFixed(2)}ms`);
            }
          }
        }

        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private formatScreenshotResult(result: any): string {
    const lines: string[] = [];

    if (result.error) {
      lines.push(`- **Error:** ${result.error}`);
      return lines.join('\n');
    }

    lines.push(`- **Status:** ${result.statusCode}`);
    lines.push(`- **Screenshot:** \`${result.screenshotPath}\``);

    if (result.axeViolations.length > 0) {
      lines.push(`- **Accessibility Violations:** ${result.axeViolations.length}`);
      const bySeverity = this.groupBySeverity(result.axeViolations);
      for (const [severity, count] of Object.entries(bySeverity)) {
        lines.push(`  - ${severity}: ${count}`);
      }
    } else {
      lines.push('- **Accessibility:** No violations');
    }

    const vitals = result.webVitals;
    if (Object.keys(vitals).length > 0) {
      lines.push('- **Web Vitals:**');
      if (vitals.LCP) lines.push(`  - LCP: ${vitals.LCP.toFixed(2)}ms`);
      if (vitals.FID) lines.push(`  - FID: ${vitals.FID.toFixed(2)}ms`);
      if (vitals.CLS) lines.push(`  - CLS: ${vitals.CLS.toFixed(3)}`);
      if (vitals.FCP) lines.push(`  - FCP: ${vitals.FCP.toFixed(2)}ms`);
      if (vitals.TTFB) lines.push(`  - TTFB: ${vitals.TTFB.toFixed(2)}ms`);
    }

    return lines.join('\n');
  }

  private groupBySeverity(violations: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const violation of violations) {
      grouped[violation.impact] = (grouped[violation.impact] || 0) + 1;
    }
    return grouped;
  }

  generateJson(report: RouteImpactReport): string {
    return JSON.stringify(report, null, 2);
  }

  writeReport(report: RouteImpactReport, outputPath: string, format: 'markdown' | 'json'): void {
    const content = format === 'markdown' ? this.generateMarkdown(report) : this.generateJson(report);
    writeFileSync(outputPath, content, 'utf-8');
  }
}
