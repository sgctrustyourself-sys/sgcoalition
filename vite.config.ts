import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { bareCheckoutGate } from './utils/bareCheckoutGate.mjs';

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:4242',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [
      // First, so a red bare-checkout rule stops the build before anything is
      // emitted. This is deliberately a build plugin and not an npm hook: a
      // Vercel build command of `npx vite build` skips every lifecycle hook, so
      // `prebuild` could be routed around. See utils/bareCheckoutGate.mjs.
      bareCheckoutGate(),
      react(),
      tailwindcss(),
      visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    // Note: the previous `manualChunks` literal-array config disabled
    // Rollup tree-shaking for `lucide-react` (1,500+ icons), `ethers`,
    // `framer-motion`, and `date-fns`, forcing the full AST of every export
    // through esbuild's transform pipeline. On Vercel's tighter build-worker
    // RAM ceiling this OOM-kills mid-`transforming...`. Rollup's default
    // chunker tree-shakes per export, so we never list named modules (which
    // would force-include whole packages). Instead, a function form groups
    // only the already-bundled vendor modules into cacheable chunks:
    // splitting moves code, it never pulls new modules in. Everything not
    // matched below keeps Rollup's default per-export tree-shaking.
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              // React core first, so every other chunk shares this instance.
              // react is CJS: its entry wrapper and cjs/ factory MUST stay in
              // the same chunk or the cross-chunk init order breaks at runtime
              // (verified: splitting them threw on boot). scheduler is
              // react-dom's only dependency; keep the family whole.
              if (
                id.includes('/node_modules/react-dom/') ||
                id.includes('\\node_modules\\react-dom\\') ||
                /[\\/]node_modules[\\/]react[\\/]/.test(id) ||
                id.includes('/node_modules/scheduler/')
              ) {
                return 'vendor-react';
              }
              if (id.includes('@supabase/')) {
                return 'vendor-supabase';
              }
              if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
                return 'vendor-motion';
              }
              if (id.includes('/react-router/')) {
                return 'vendor-router';
              }
            }
            return undefined;
          },
        },
      },
      // iPad Safari versions in the field can be older than the current
      // default browser target. Lowering the target keeps the entry module
      // parseable so a syntax rejection cannot strand users behind the
      // inline #initial-loader before React mounts.
      target: 'safari12',
      sourcemap: true,
    },
  };
});
