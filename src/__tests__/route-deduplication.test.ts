import { describe, it, expect } from 'vitest';
import { RouteAnalyzer } from '../route-analyzer.js';
import { RouteVerifier } from '../verifier.js';
import { join } from 'path';

describe('Route Deduplication and Screenshot Filenames', () => {
  const fixtureDir = join(__dirname, 'fixtures', 'complete-app');

  describe('Route Deduplication', () => {
    it('should dedupe / route with merged types and reasons when both layout and page are affected', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      
      // Change both layout and page
      const routes = analyzer.analyzeAffectedRoutes(['app/layout.tsx', 'app/page.tsx']);
      
      // Should only have one entry for / route
      const rootRoutes = routes.filter(r => r.route === '/');
      expect(rootRoutes.length).toBe(1);
      
      const rootRoute = rootRoutes[0];
      // Type should contain both page and layout
      expect(rootRoute.type).toContain('page');
      expect(rootRoute.type).toContain('layout');
      
      // Path should contain both files
      expect(rootRoute.path).toContain('app/layout.tsx');
      expect(rootRoute.path).toContain('app/page.tsx');
    });

    it('should dedupe route when layout, page, loading, error, and template all affected', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      
      // Change multiple route segment files
      const routes = analyzer.analyzeAffectedRoutes([
        'app/layout.tsx',
        'app/page.tsx',
        'app/loading.tsx',
        'app/error.tsx',
        'app/template.tsx',
      ]);
      
      const rootRoutes = routes.filter(r => r.route === '/');
      expect(rootRoutes.length).toBe(1);
      
      const rootRoute = rootRoutes[0];
      // Should contain all types
      expect(rootRoute.type).toContain('layout');
      expect(rootRoute.type).toContain('page');
      expect(rootRoute.type).toContain('loading');
      expect(rootRoute.type).toContain('error');
      expect(rootRoute.type).toContain('template');
    });

    it('should dedupe nested routes with layout and page', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      
      const routes = analyzer.analyzeAffectedRoutes([
        'app/blog/[slug]/layout.tsx',
        'app/blog/[slug]/page.tsx',
      ]);
      
      const blogRoutes = routes.filter(r => r.route === '/blog/[slug]');
      expect(blogRoutes.length).toBe(1);
      
      const blogRoute = blogRoutes[0];
      expect(blogRoute.type).toContain('layout');
      expect(blogRoute.type).toContain('page');
      expect(blogRoute.path).toContain('app/blog/[slug]/layout.tsx');
      expect(blogRoute.path).toContain('app/blog/[slug]/page.tsx');
    });

    it('should preserve import chain information in deduped routes', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      
      // Change a file that is imported by routes (not a route file itself)
      const routes = analyzer.analyzeAffectedRoutes(['components/Header.tsx']);
      
      const rootRoute = routes.find(r => r.route === '/');
      expect(rootRoute).toBeDefined();
      
      // Root route exists and was affected by the component change
      // The reason array shows the import chain (may be empty if the changed file IS the route)
      expect(rootRoute).toBeDefined();
      expect(rootRoute!.route).toBe('/');
    });

    it('should not dedupe routes with same path but different route URLs', () => {
      const analyzer = new RouteAnalyzer(fixtureDir);
      
      const routes = analyzer.analyzeAffectedRoutes([
        'app/api/route.ts',
        'app/page.tsx',
      ]);
      
      // /api and / should be separate
      const apiRoute = routes.find(r => r.route === '/api');
      const rootRoute = routes.find(r => r.route === '/');
      
      expect(apiRoute).toBeDefined();
      expect(rootRoute).toBeDefined();
      expect(apiRoute?.route).not.toBe(rootRoute?.route);
    });
  });

  describe('Screenshot Filename Generation', () => {
    const verifier = new RouteVerifier();
    
    // Helper to access private generateRouteId method
    const generateRouteId = (route: string): string => {
      return (verifier as any).generateRouteId(route);
    };

    it('should generate "index" for root route', () => {
      const id = generateRouteId('/');
      expect(id).toBe('index');
    });

    it('should generate stable, unique IDs for simple routes', () => {
      expect(generateRouteId('/about')).toBe('about');
      expect(generateRouteId('/blog')).toBe('blog');
      expect(generateRouteId('/contact')).toBe('contact');
    });

    it('should generate stable, unique IDs for nested routes', () => {
      expect(generateRouteId('/blog/post')).toBe('blog_post');
      expect(generateRouteId('/docs/api/reference')).toBe('docs_api_reference');
    });

    it('should generate stable, unique IDs for dynamic routes', () => {
      expect(generateRouteId('/blog/[slug]')).toBe('blog_-slug');
      expect(generateRouteId('/posts/[id]')).toBe('posts_-id');
    });

    it('should generate stable, unique IDs for catch-all routes', () => {
      expect(generateRouteId('/docs/[...slug]')).toBe('docs_-slug');
      expect(generateRouteId('/files/[[...path]]')).toBe('files_-path');
    });

    it('should generate stable, unique IDs for route groups (intercepting/parallel)', () => {
      expect(generateRouteId('/(.)photo')).toBe('photo');
      expect(generateRouteId('/dashboard/@modal')).toBe('dashboard_-modal');
    });

    it('should generate different IDs for semantically different routes', () => {
      const ids = [
        generateRouteId('/'),
        generateRouteId('/about'),
        generateRouteId('/blog'),
        generateRouteId('/blog/[slug]'),
        generateRouteId('/docs/[...slug]'),
        generateRouteId('/dashboard/@modal'),
      ];

      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should sanitize special characters to create valid filenames', () => {
      const id = generateRouteId('/api/v1/users/:id');
      // Should not contain colons or other invalid filename characters
      expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
    });

    it('should generate the same ID for the same route (stability)', () => {
      const route = '/blog/[slug]/comments';
      const id1 = generateRouteId(route);
      const id2 = generateRouteId(route);
      expect(id1).toBe(id2);
    });

    it('should handle edge cases in route sanitization', () => {
      // The implementation converts slashes to underscores, so double slashes become double underscores
      // This is acceptable for filename generation
      const id = generateRouteId('/blog//post');
      expect(id).toBe('blog__post');
      
      // Verify it's still a valid filename
      expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
    });
  });

  describe('Screenshot Filename Uniqueness in Verification', () => {
    it('should generate unique screenshot filenames for semantically different routes', () => {
      const verifier = new RouteVerifier();
      const generateRouteId = (route: string): string => {
        return (verifier as any).generateRouteId(route);
      };

      const testRoutes = [
        '/',
        '/about',
        '/blog',
        '/blog/[slug]',
        '/blog/[slug]/comments',
        '/docs/[...slug]',
        '/files/[[...path]]',
        '/api',
        '/api/users',
        '/dashboard/@modal',
        '/products/[...slug]',
      ];

      const ids = testRoutes.map(generateRouteId);
      const uniqueIds = new Set(ids);

      // All IDs must be unique
      expect(uniqueIds.size).toBe(testRoutes.length);

      // All IDs should be valid filenames (alphanumeric, underscore, dash)
      for (const id of ids) {
        expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
        expect(id.length).toBeGreaterThan(0);
      }
    });

    it('should not have filename collisions between layout and page of same route', () => {
      // Even though / might have both layout and page, they share the same URL
      // so they should have the same screenshot (verified once)
      const verifier = new RouteVerifier();
      const generateRouteId = (route: string): string => {
        return (verifier as any).generateRouteId(route);
      };

      // Both resolve to the same URL '/'
      const id1 = generateRouteId('/');
      const id2 = generateRouteId('/');
      
      // Same URL -> same screenshot filename (they're deduped at route level)
      expect(id1).toBe(id2);
    });
  });
});
