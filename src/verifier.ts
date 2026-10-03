import { chromium, Browser, Page } from 'playwright';
import type { AxeResults } from 'axe-core';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { VerificationResult, ScreenshotResult, AxeViolation, WebVitalsMetrics } from './types.js';

export interface VerifyOptions {
  baseUrl: string;
  headUrl: string;
  routes: string[];
  outputDir: string;
  timeout?: number;
}

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

    const before = await this.captureScreenshot(baseUrl, route, 'before', options.outputDir, options.timeout);
    const after = await this.captureScreenshot(headUrl, route, 'after', options.outputDir, options.timeout);

    return {
      route,
      url: headUrl,
      before,
      after,
      diff: this.computeDiff(before, after),
    };
  }

  private async captureScreenshot(
    url: string,
    route: string,
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

      const sanitizedRoute = route.replace(/\//g, '_').replace(/[^a-zA-Z0-9_-]/g, '') || 'root';
      const screenshotPath = join(outputDir, `${sanitizedRoute}-${variant}.png`);
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
      await page.addScriptTag({
        content: readFileSync(require.resolve('axe-core/axe.min.js'), 'utf-8'),
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

  private computeDiff(before: ScreenshotResult, after: ScreenshotResult) {
    const beforeIds = new Set(before.axeViolations.map(v => v.id));
    const afterIds = new Set(after.axeViolations.map(v => v.id));

    const axeViolationsAdded = after.axeViolations.filter(v => !beforeIds.has(v.id));
    const axeViolationsRemoved = before.axeViolations.filter(v => !afterIds.has(v.id));

    const vitalsDeltas: Partial<Record<keyof WebVitalsMetrics, number>> = {};
    let webVitalsRegression = false;

    for (const key of ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'] as Array<keyof WebVitalsMetrics>) {
      const beforeValue = before.webVitals[key];
      const afterValue = after.webVitals[key];

      if (beforeValue !== undefined && afterValue !== undefined) {
        const delta = afterValue - beforeValue;
        vitalsDeltas[key] = delta;

        if (delta > beforeValue * 0.1) {
          webVitalsRegression = true;
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
