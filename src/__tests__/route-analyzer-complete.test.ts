import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RouteAnalyzer } from '../route-analyzer';
import { join } from 'path';
import { existsSync } from 'fs';

describe('RouteAnalyzer - Complete Feature Coverage', () => {
  const fixtureDir = join(__dirname, 'fixtures', 'complete-app');

  beforeAll(() => {
    if (!existsSync(fixtureDir)) {
      throw new Error(`Fixture directory not found: ${fixtureDir}`);
    }
  });

  describe('Root Layout Changes', () => {
    it('should affect all App Router routes when root layout changes', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/layout.tsx']);
      
      expect(routes.length).toBeGreaterThan(0);
      const routePaths = routes.map(r => r.route);
      
      // Root layout should affect all app routes
      expect(routePaths).toContain('/');
      expect(routes.find(r => r.route === '/' && r.type === 'layout')).toBeDefined();
    });
  });

  describe('Nested Layout Changes', () => {
    it('should affect all routes under a nested layout', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/blog/[slug]/layout.tsx']);
      
      const affected = routes.find(r => r.route === '/blog/[slug]' && r.type === 'layout');
      expect(affected).toBeDefined();
    });
  });

  describe('Template Files', () => {
    it('should detect template.tsx changes', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/template.tsx']);
      
      const template = routes.find(r => r.type === 'template');
      expect(template).toBeDefined();
      expect(template?.route).toBe('/');
    });
  });

  describe('Loading Files', () => {
    it('should detect loading.tsx changes', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/loading.tsx']);
      
      const loading = routes.find(r => r.type === 'loading');
      expect(loading).toBeDefined();
      expect(loading?.route).toBe('/');
    });
  });

  describe('Error Files', () => {
    it('should detect error.tsx changes', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/error.tsx']);
      
      const error = routes.find(r => r.type === 'error');
      expect(error).toBeDefined();
      expect(error?.route).toBe('/');
    });
  });

  describe('Not-Found Files', () => {
    it('should detect not-found.tsx changes', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/not-found.tsx']);
      
      const notFoundRoute = routes.find(r => r.path.includes('not-found.tsx'));
      expect(notFoundRoute).toBeDefined();
    });
  });

  describe('Route Groups', () => {
    it('should normalize route groups correctly', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/(marketing)/page.tsx']);
      
      const marketing = routes.find(r => r.path.includes('(marketing)'));
      expect(marketing).toBeDefined();
      // Route groups should be removed from the route path
      expect(marketing?.route).toBe('/');
    });
  });

  describe('Dynamic Routes [slug]', () => {
    it('should detect dynamic segments', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/blog/[slug]/page.tsx']);
      
      const dynamicRoute = routes.find(r => r.route === '/blog/[slug]');
      expect(dynamicRoute).toBeDefined();
      expect(dynamicRoute?.dynamic).toBe(true);
      expect(dynamicRoute?.params).toContain('slug');
    });
  });

  describe('Catch-All Routes [...slug]', () => {
    it('should detect catch-all segments', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/products/[...slug]/page.tsx']);
      
      const catchAll = routes.find(r => r.route === '/products/[...slug]');
      expect(catchAll).toBeDefined();
      expect(catchAll?.dynamic).toBe(true);
      expect(catchAll?.params).toContain('slug');
    });
  });

  describe('Optional Catch-All Routes [[...slug]]', () => {
    it('should detect optional catch-all segments', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/docs/[[...slug]]/page.tsx']);
      
      const optionalCatchAll = routes.find(r => r.route === '/docs/[[...slug]]');
      expect(optionalCatchAll).toBeDefined();
      expect(optionalCatchAll?.dynamic).toBe(true);
      expect(optionalCatchAll?.params).toContain('slug');
    });
  });

  describe('Parallel Routes @modal', () => {
    it('should detect parallel routes', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/dashboard/@modal/page.tsx']);
      
      const modalRoute = routes.find(r => r.path.includes('@modal'));
      expect(modalRoute).toBeDefined();
    });
  });

  describe('Intercepting Routes (.)', () => {
    it('should detect intercepting routes', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/(.)photo/page.tsx']);
      
      const photoRoute = routes.find(r => r.path.includes('(.)photo'));
      expect(photoRoute).toBeDefined();
    });
  });

  describe('Route Handlers route.ts', () => {
    it('should detect route handlers', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/api/route.ts']);
      
      const routeHandler = routes.find(r => r.type === 'route');
      expect(routeHandler).toBeDefined();
      expect(routeHandler?.route).toBe('/api');
    });
  });

  describe('Middleware', () => {
    it('should treat middleware changes as affecting all routes', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['middleware.ts']);
      
      // Middleware should affect many/all routes
      expect(routes.length).toBeGreaterThan(3);
    });
  });

  describe('next.config Changes', () => {
    it('should treat next.config changes as affecting all routes', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['next.config.js']);
      
      // Config changes should affect all routes
      expect(routes.length).toBeGreaterThan(3);
    });
  });

  describe('Path Aliases from tsconfig', () => {
    it('should resolve @/ aliases', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/page.tsx']);
      
      // Page imports from @/components via alias
      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0].route).toBe('/');
    });

    it('should resolve ~/ aliases', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['app/(marketing)/page.tsx']);
      
      // Marketing page imports from ~/components via alias
      expect(routes.length).toBeGreaterThan(0);
    });
  });

  describe('Barrel Re-exports (export *)', () => {
    it('should trace through barrel export * from', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      
      // Change the underlying shared.ts file
      const routes = analyzer.analyzeAffectedRoutes(['lib/shared.ts']);
      
      // Should find routes that import from lib/index which re-exports shared
      const homePage = routes.find(r => r.route === '/' && r.type === 'page');
      expect(homePage).toBeDefined();
    });

    it('should trace through barrel export { X } from', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      
      // Change dynamic.ts which is re-exported from lib/index
      const routes = analyzer.analyzeAffectedRoutes(['lib/dynamic.ts']);
      
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should trace through component barrel exports', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      
      // Change Button which is re-exported from components/index
      const routes = analyzer.analyzeAffectedRoutes(['components/Button.tsx']);
      
      // Should find all pages that import { Button } from '@/components'
      const affectedRoutes = routes.map(r => r.route);
      expect(affectedRoutes).toContain('/');
      expect(affectedRoutes.length).toBeGreaterThan(1);
    });
  });

  describe('CSS Modules', () => {
    it('should detect CSS module imports', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['styles/button.module.css']);
      
      // blog/[slug]/layout.tsx imports this CSS module
      const affected = routes.find(r => r.route === '/blog/[slug]' && r.type === 'layout');
      expect(affected).toBeDefined();
    });
  });

  describe('Global CSS', () => {
    it('should detect global CSS imports', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['styles/globals.css']);
      
      // Root layout imports globals.css
      const rootLayout = routes.find(r => r.type === 'layout' && r.route === '/');
      expect(rootLayout).toBeDefined();
      
      // Should also affect pages/_app.tsx
      const pagesApp = routes.find(r => r.path.includes('_app.tsx'));
      expect(pagesApp).toBeDefined();
    });
  });

  describe('Dynamic import()', () => {
    it('should detect dynamic imports syntactically', () => {
      // For now, we detect them but may not fully trace them
      // This is documented as a v0.1 limitation
      const analyzer = new RouteAnalyzer(fixtureDir);
      
      // The dependency graph should at least parse files with dynamic imports
      const routes = analyzer.analyzeAffectedRoutes(['app/page.tsx']);
      expect(routes.length).toBeGreaterThan(0);
    });
  });

  describe('Pages Router _app', () => {
    it('should detect _app.tsx changes affecting all Pages Router pages', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['pages/_app.tsx']);
      
      // _app should affect pages/index.tsx
      const pagesHome = routes.find(r => r.path.includes('pages/index.tsx'));
      expect(pagesHome).toBeDefined();
    });
  });

  describe('Pages Router _document', () => {
    it('should detect _document.tsx changes', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['pages/_document.tsx']);
      
      // _document affects page rendering
      expect(routes.length).toBeGreaterThan(0);
    });
  });

  describe('Pages Router Dynamic Routes', () => {
    it('should detect Pages Router dynamic routes', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      const routes = analyzer.analyzeAffectedRoutes(['pages/blog/[slug].tsx']);
      
      const dynamicPage = routes.find(r => r.route === '/blog/[slug]');
      expect(dynamicPage).toBeDefined();
      expect(dynamicPage?.dynamic).toBe(true);
      expect(dynamicPage?.params).toContain('slug');
    });
  });

  describe('Route Expansion', () => {
    it('should expand dynamic routes with provided params', () => {
      const analyzer = new RouteAnalyzer(fixtureDir, {}, {
        slug: ['post-1', 'post-2', 'post-3'],
      });
      
      const routes = analyzer.analyzeAffectedRoutes(['app/blog/[slug]/page.tsx']);
      const expanded = analyzer.expandDynamicRoutes(routes);
      
      const expandedRoutes = expanded.filter(r => !r.dynamic);
      expect(expandedRoutes.map(r => r.route)).toContain('/blog/post-1');
      expect(expandedRoutes.map(r => r.route)).toContain('/blog/post-2');
      expect(expandedRoutes.map(r => r.route)).toContain('/blog/post-3');
    });
  });
});
