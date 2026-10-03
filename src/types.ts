export interface RouteImpactConfig {
  baseDir: string;
  gitDiff?: {
    base: string;
    head: string;
  };
  workingTree?: boolean;
  nextjsVersion?: 'app' | 'pages' | 'both';
  dynamicParams?: Record<string, string[]>;
  pathAliases?: Record<string, string>;
  webVitalsThresholds?: WebVitalsThresholds;
}

export interface WebVitalsThresholds {
  /** Absolute threshold in milliseconds (default: 10ms) */
  absoluteMs?: number;
  /** Relative threshold as a percentage (default: 10%) */
  relativePercent?: number;
  /** Per-metric absolute thresholds in milliseconds */
  perMetric?: {
    LCP?: number;
    FID?: number;
    FCP?: number;
    TTFB?: number;
  };
  /** CLS threshold (unitless, default: 0.05) */
  cls?: number;
}

export interface AffectedRoute {
  route: string;
  path: string;
  type: 'page' | 'layout' | 'template' | 'loading' | 'error' | 'route' | 'middleware';
  reason: ImportChain[];
  dynamic: boolean;
  params?: string[];
}

export interface ImportChain {
  file: string;
  importedBy: string;
  depth: number;
}

export interface VerificationResult {
  route: string;
  url: string;
  before: ScreenshotResult;
  after: ScreenshotResult;
  diff: VerificationDiff;
}

export interface ScreenshotResult {
  screenshotPath: string;
  axeViolations: AxeViolation[];
  webVitals: WebVitalsMetrics;
  statusCode: number;
  error?: string;
}

export interface AxeViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  nodes: number;
  helpUrl: string;
}

export interface WebVitalsMetrics {
  LCP?: number;
  FID?: number;
  CLS?: number;
  FCP?: number;
  TTFB?: number;
}

export interface VerificationDiff {
  visualDiff: boolean;
  axeViolationsAdded: AxeViolation[];
  axeViolationsRemoved: AxeViolation[];
  webVitalsRegression: boolean;
  vitalsDeltas: Partial<Record<keyof WebVitalsMetrics, number>>;
}

export interface ReportOutput {
  format: 'markdown' | 'json';
  destination?: string;
}

export interface RouteImpactReport {
  timestamp: string;
  gitDiff?: {
    base: string;
    head: string;
  };
  affectedRoutes: AffectedRoute[];
  verifications?: VerificationResult[];
  summary: {
    totalRoutes: number;
    dynamicRoutes: number;
    staticRoutes: number;
    verified: number;
  };
}
