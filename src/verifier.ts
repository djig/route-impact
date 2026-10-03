import { chromium, Browser, Page } from 'playwright';
import type { AxeResults } from 'axe-core';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { VerificationResult, ScreenshotResult, AxeViolation, WebVitalsMetrics, WebVitalsThresholds } from './types.js';

export interface VerifyOptions {
  baseUrl: string;
  headUrl: string;
  routes: string[];
  outputDir: string;
  timeout?: number;
  webVitalsThresholds?: WebVitalsThresholds;
}

const DEFAULT_THRESHOLDS: Required<WebVitalsThresholds> = {
  absoluteMs: 10,
  relativePercent: 10,
  cls: 0.05,
  perMetric: {
    LCP: 50,
    FID: 10,
    FCP: 10,
    TTFB: 10,
  },
};

export class RouteVerifier {
  private browser: Browser | null = null;

  async verify(options: VerifyOptions): Promise<VerificationResult[]> {
    this.browser = await chromium.launch({ headless: true });
    const results: VerificationResult[] = [];

    try {
      for (const route of options.routes) {
        const result = await this.verifyRoute(route, options);
        results.push(result);
      }
    } finally {
      await this.browser?.close();
      this.browser = null;
    }

    return results;
  }

  private async verifyRoute(route: string, options: VerifyOptions): Promise<VerificationResult> {
    const baseUrl = `${options.baseUrl}${route}`;
    const headUrl = `${options.headUrl}${route}`;

    // Create a unique, stable filename based on route
    const routeId = this.generateRouteId(route);
    
    const before = await this.captureScreenshot(baseUrl, routeId, 'before', options.outputDir, options.timeout);
    const after = await this.captureScreenshot(headUrl, routeId, 'after', options.outputDir, options.timeout);

    return {
      route,
      url: headUrl,
      before,
      after,
      diff: this.computeDiff(before, after, options.webVitalsThresholds),
    };
  }

  private generateRouteId(route: string): string {
    // Generate a unique, stable identifier for screenshot filenames
    // Use a combination of sanitized route and a stable hash
    const sanitized = route
      .replace(/^\//, '') // Remove leading slash
      .replace(/\//g, '_') // Replace slashes with underscores
      .replace(/[^a-zA-Z0-9_-]/g, '-') // Replace special chars with dashes
      .replace(/-+/g, '-') // Collapse multiple dashes
      .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
    
    // For root route, use 'index'
    return sanitized || 'index';
  }

  private async captureScreenshot(
    url: string,
    routeId: string,
    variant: 'before' | 'after',
    outputDir: string,
    timeout = 30000
  ): Promise<ScreenshotResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    const result: ScreenshotResult = {
      screenshotPath: '',
      axeViolations: [],
      webVitals: {},
      statusCode: 0,
    };

    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout });
      result.statusCode = response?.status() || 0;

      if (result.statusCode >= 400) {
        result.error = `HTTP ${result.statusCode}`;
        return result;
      }

      await page.waitForTimeout(1000);

      const screenshotPath = join(outputDir, `${routeId}-${variant}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      result.screenshotPath = screenshotPath;

      result.axeViolations = await this.runAxe(page);
      result.webVitals = await this.measureWebVitals(page);
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    } finally {
      await page.close();
    }

    return result;
  }

  private async runAxe(page: Page): Promise<AxeViolation[]> {
    try {
      // Read axe-core from node_modules (ESM-compatible)
      const axePath = join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js');
      await page.addScriptTag({
        content: readFileSync(axePath, 'utf-8'),
      });

      const axeResults = (await page.evaluate(() => {
        return (globalThis as any).axe.run();
      })) as AxeResults;

      return axeResults.violations.map(violation => ({
        id: violation.id,
        impact: violation.impact as 'minor' | 'moderate' | 'serious' | 'critical',
        description: violation.description,
        nodes: violation.nodes.length,
        helpUrl: violation.helpUrl,
      }));
    } catch (error) {
      console.warn('Failed to run axe:', error);
      return [];
    }
  }

  private async measureWebVitals(page: Page): Promise<WebVitalsMetrics> {
    try {
      const metrics = await page.evaluate(() => {
        return new Promise<any>(resolve => {
          const vitals: any = {};
          let collected = 0;
          const totalMetrics = 5;

          const timeout = setTimeout(() => {
            resolve(vitals);
          }, 5000);

          const checkComplete = () => {
            collected++;
            if (collected >= totalMetrics) {
              clearTimeout(timeout);
              resolve(vitals);
            }
          };

          if ('PerformanceObserver' in globalThis) {
            try {
              const lcpObserver = new PerformanceObserver(list => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1] as any;
                vitals.LCP = lastEntry.renderTime || lastEntry.loadTime;
                checkComplete();
              });
              lcpObserver.observe({ type: 'largest-contentful-paint' as any, buffered: true });

              const fidObserver = new PerformanceObserver(list => {
                const entries = list.getEntries();
                vitals.FID = entries[0] ? (entries[0] as any).processingStart - entries[0].startTime : undefined;
                checkComplete();
              });
              fidObserver.observe({ type: 'first-input' as any, buffered: true });

              const clsObserver = new PerformanceObserver(list => {
                let cls = 0;
                for (const entry of list.getEntries()) {
                  if ((entry as any).hadRecentInput) continue;
                  cls += (entry as any).value;
                }
                vitals.CLS = cls;
                checkComplete();
              });
              clsObserver.observe({ type: 'layout-shift' as any, buffered: true });
            } catch (_e) {
              checkComplete();
              checkComplete();
              checkComplete();
            }
          } else {
            checkComplete();
            checkComplete();
            checkComplete();
          }

          const navigation = performance.getEntriesByType('navigation' as any)[0] as any;
          if (navigation) {
            vitals.FCP = navigation.responseStart - navigation.fetchStart;
            vitals.TTFB = navigation.responseStart - navigation.requestStart;
          }
          checkComplete();
          checkComplete();
        });
      });

      return metrics;
    } catch (error) {
      console.warn('Failed to measure Web Vitals:', error);
      return {};
    }
  }

  private computeDiff(before: ScreenshotResult, after: ScreenshotResult, thresholds?: WebVitalsThresholds) {
    const beforeIds = new Set(before.axeViolations.map(v => v.id));
    const afterIds = new Set(after.axeViolations.map(v => v.id));

    const axeViolationsAdded = after.axeViolations.filter(v => !beforeIds.has(v.id));
    const axeViolationsRemoved = before.axeViolations.filter(v => !afterIds.has(v.id));

    const vitalsDeltas: Partial<Record<keyof WebVitalsMetrics, number>> = {};
    let webVitalsRegression = false;

    // Merge provided thresholds with defaults
    const config: Required<WebVitalsThresholds> = {
      ...DEFAULT_THRESHOLDS,
      ...thresholds,
      perMetric: {
        ...DEFAULT_THRESHOLDS.perMetric,
        ...(thresholds?.perMetric || {}),
      },
    };

    for (const key of ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'] as Array<keyof WebVitalsMetrics>) {
      const beforeValue = before.webVitals[key];
      const afterValue = after.webVitals[key];

      if (beforeValue !== undefined && afterValue !== undefined) {
        const delta = afterValue - beforeValue;
        vitalsDeltas[key] = delta;

        // Only flag as regression if delta exceeds thresholds
        if (delta > 0) {
          let exceedsThreshold = false;

          if (key === 'CLS') {
            // CLS is unitless, use CLS-specific threshold
            exceedsThreshold = delta > config.cls;
          } else {
            // Check per-metric threshold first
            const perMetricThreshold = config.perMetric[key as keyof typeof config.perMetric];
            if (perMetricThreshold !== undefined && delta > perMetricThreshold) {
              exceedsThreshold = true;
            } else {
              // Check absolute and relative thresholds
              const absoluteThreshold = config.absoluteMs;
              const relativeThreshold = beforeValue * (config.relativePercent / 100);
              
              exceedsThreshold = delta > absoluteThreshold && delta > relativeThreshold;
            }
          }

          if (exceedsThreshold) {
            webVitalsRegression = true;
          }
        }
      }
    }

    const visualDiff = before.screenshotPath !== after.screenshotPath;

    return {
      visualDiff,
      axeViolationsAdded,
      axeViolationsRemoved,
      webVitalsRegression,
      vitalsDeltas,
    };
  }
}
