import { describe, it, expect } from 'vitest';
import { RouteVerifier } from '../verifier.js';
import type { ScreenshotResult } from '../types.js';

describe('Web Vitals Thresholds', () => {
  const verifier = new RouteVerifier();

  // Helper to access private computeDiff method via type assertion
  const computeDiff = (before: ScreenshotResult, after: ScreenshotResult, thresholds?: any) => {
    return (verifier as any).computeDiff(before, after, thresholds);
  };

  const createMockResult = (lcp: number, fcp: number, ttfb: number, cls: number): ScreenshotResult => ({
    screenshotPath: '/path/to/screenshot.png',
    axeViolations: [],
    webVitals: { LCP: lcp, FCP: fcp, TTFB: ttfb, CLS: cls },
    statusCode: 200,
  });

  describe('Default Thresholds (10ms absolute, 10% relative, 0.05 CLS)', () => {
    it('should not flag regression when delta is below absolute threshold (10ms)', () => {
      const before = createMockResult(100, 50, 20, 0.1);
      const after = createMockResult(108, 58, 28, 0.1); // +8ms LCP, +8ms FCP, +8ms TTFB

      const diff = computeDiff(before, after);

      expect(diff.webVitalsRegression).toBe(false);
      expect(diff.vitalsDeltas.LCP).toBe(8);
      expect(diff.vitalsDeltas.FCP).toBe(8);
      expect(diff.vitalsDeltas.TTFB).toBe(8);
    });

    it('should not flag regression when delta is below relative threshold (10%)', () => {
      const before = createMockResult(200, 100, 50, 0.1);
      const after = createMockResult(215, 108, 54, 0.1); // +7.5% LCP, +8% FCP, +8% TTFB

      const diff = computeDiff(before, after);

      expect(diff.webVitalsRegression).toBe(false);
      expect(diff.vitalsDeltas.LCP).toBe(15);
      expect(diff.vitalsDeltas.FCP).toBe(8);
      expect(diff.vitalsDeltas.TTFB).toBe(4);
    });

    it('should flag regression when delta exceeds both absolute AND relative thresholds', () => {
      const before = createMockResult(100, 50, 20, 0.1);
      const after = createMockResult(125, 70, 35, 0.1); // +25ms (25%) LCP, +20ms (40%) FCP, +15ms (75%) TTFB

      const diff = computeDiff(before, after);

      expect(diff.webVitalsRegression).toBe(true);
      expect(diff.vitalsDeltas.LCP).toBe(25);
      expect(diff.vitalsDeltas.FCP).toBe(20);
      expect(diff.vitalsDeltas.TTFB).toBe(15);
    });

    it('should use unitless threshold for CLS (0.05 default)', () => {
      const before = createMockResult(100, 50, 20, 0.1);
      const after = createMockResult(100, 50, 20, 0.14); // +0.04 CLS (below 0.05)

      const diffBelow = computeDiff(before, after);
      expect(diffBelow.webVitalsRegression).toBe(false);

      const after2 = createMockResult(100, 50, 20, 0.17); // +0.07 CLS (above 0.05)
      const diffAbove = computeDiff(before, after2);
      expect(diffAbove.webVitalsRegression).toBe(true);
    });

    it('should not flag regression for improvements (negative deltas)', () => {
      const before = createMockResult(200, 100, 50, 0.2);
      const after = createMockResult(100, 50, 25, 0.1); // All improved

      const diff = computeDiff(before, after);

      expect(diff.webVitalsRegression).toBe(false);
      expect(diff.vitalsDeltas.LCP).toBe(-100);
      expect(diff.vitalsDeltas.FCP).toBe(-50);
      expect(diff.vitalsDeltas.TTFB).toBe(-25);
      expect(diff.vitalsDeltas.CLS).toBe(-0.1);
    });
  });

  describe('Custom Thresholds', () => {
    it('should respect custom absoluteMs threshold', () => {
      const before = createMockResult(100, 50, 20, 0.1);
      const after = createMockResult(140, 50, 20, 0.1); // +40ms LCP (40%)

      // With 50ms threshold, should not flag
      const diffBelow = computeDiff(before, after, { absoluteMs: 50 });
      expect(diffBelow.webVitalsRegression).toBe(false);

      // With 30ms threshold, should flag
      const diffAbove = computeDiff(before, after, { absoluteMs: 30 });
      expect(diffAbove.webVitalsRegression).toBe(true);
    });

    it('should respect custom relativePercent threshold', () => {
      const before = createMockResult(100, 50, 20, 0.1);
      const after = createMockResult(130, 50, 20, 0.1); // +30ms LCP (30%)

      // With 50% threshold, should not flag (even though >10ms)
      const diffBelow = computeDiff(before, after, { relativePercent: 50 });
      expect(diffBelow.webVitalsRegression).toBe(false);

      // With 20% threshold, should flag (both >10ms and >20%)
      const diffAbove = computeDiff(before, after, { relativePercent: 20 });
      expect(diffAbove.webVitalsRegression).toBe(true);
    });

    it('should respect custom CLS threshold', () => {
      const before = createMockResult(100, 50, 20, 0.1);
      const after = createMockResult(100, 50, 20, 0.18); // +0.08 CLS

      // With 0.1 threshold, should not flag
      const diffBelow = computeDiff(before, after, { cls: 0.1 });
      expect(diffBelow.webVitalsRegression).toBe(false);

      // With 0.05 threshold, should flag
      const diffAbove = computeDiff(before, after, { cls: 0.05 });
      expect(diffAbove.webVitalsRegression).toBe(true);
    });

    it('should respect per-metric thresholds that override absoluteMs', () => {
      const before = createMockResult(100, 50, 20, 0.1);
      const after = createMockResult(160, 80, 35, 0.1); // +60ms LCP, +30ms FCP, +15ms TTFB

      const thresholds = {
        absoluteMs: 10,
        relativePercent: 10,
        perMetric: {
          LCP: 70, // Override: LCP needs >70ms to flag
          FCP: 25, // Override: FCP needs >25ms to flag
        },
      };

      const diff = computeDiff(before, after, thresholds);

      // LCP: 60ms delta, but needs >70ms per-metric threshold -> not flagged
      // FCP: 30ms delta, exceeds 25ms per-metric threshold -> would flag
      // TTFB: 15ms delta, exceeds default 10ms AND 10% relative -> would flag
      expect(diff.webVitalsRegression).toBe(true); // FCP and TTFB cause regression
      expect(diff.vitalsDeltas.LCP).toBe(60);
      expect(diff.vitalsDeltas.FCP).toBe(30);
      expect(diff.vitalsDeltas.TTFB).toBe(15);
    });

    it('should handle missing vitals gracefully', () => {
      const before: ScreenshotResult = {
        screenshotPath: '/path/to/screenshot.png',
        axeViolations: [],
        webVitals: { LCP: 100 }, // Only LCP present
        statusCode: 200,
      };
      const after: ScreenshotResult = {
        screenshotPath: '/path/to/screenshot.png',
        axeViolations: [],
        webVitals: { LCP: 200, FCP: 50 }, // LCP and FCP present
        statusCode: 200,
      };

      const diff = computeDiff(before, after);

      expect(diff.vitalsDeltas.LCP).toBe(100);
      expect(diff.vitalsDeltas.FCP).toBeUndefined(); // FCP not in before
      expect(diff.vitalsDeltas.TTFB).toBeUndefined(); // TTFB not in either
    });
  });

  describe('Threshold Logic Edge Cases', () => {
    it('should require BOTH absolute and relative thresholds to be exceeded', () => {
      const before = createMockResult(1000, 500, 200, 0.1);
      const after = createMockResult(1015, 500, 200, 0.1); // +15ms LCP (1.5%)

      // Exceeds absolute (10ms) but not relative (10%)
      const diff1 = computeDiff(before, after);
      expect(diff1.webVitalsRegression).toBe(false);

      const before2 = createMockResult(50, 25, 10, 0.1);
      const after2 = createMockResult(58, 25, 10, 0.1); // +8ms LCP (16%)

      // Exceeds relative (10%) but not absolute (10ms)
      const diff2 = computeDiff(before2, after2);
      expect(diff2.webVitalsRegression).toBe(false);
    });

    it('should handle zero baseline values', () => {
      const before = createMockResult(0, 0, 0, 0);
      const after = createMockResult(100, 50, 20, 0.1);

      // Any positive change from 0 should be flagged
      const diff = computeDiff(before, after);
      expect(diff.webVitalsRegression).toBe(true);
    });
  });
});
