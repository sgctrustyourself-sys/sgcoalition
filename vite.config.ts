import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { bareCheckoutGate } from './utils/bareCheckoutGate.mjs';
import { deployTreeGuard } from './utils/deployTreeGuard.mjs';
import { stripeEnvPolicy } from './utils/stripeEnvPolicy.mjs';

export default defineConfig(({ mode }) => {
  const analyze = mode === 'analyze';
  const debug = mode === 'debug';
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
      // And a build that is not Production may not carry a live Stripe credential:
      // a preview holding one can create real objects on the business account while
      // still being unable to mount a Stripe Element. Same reasoning as the gate
      // above — it rides in the build, where no build command can skip it. See
      // utils/stripeEnvPolicy.mjs.
      stripeEnvPolicy(),
      // Vite copies public/ before closeBundle and writes the bundle there too,
      // so this checks the actual deploy tree. It is a build hook rather than an
      // npm postbuild hook because `npx vite build` skips npm lifecycle scripts.
      // See utils/deployTreeGuard.mjs.
      deployTreeGuard(),
      react(),
      tailwindcss(),
      // Bundle reports are build diagnostics, not site assets. Keep the
      // treemap out of dist and only generate it for an explicit analyze build.
      ...(analyze ? [visualizer({
        filename: path.resolve(__dirname, 'bundle-analysis/stats.html'),
        open: false,
        gzipSize: true,
        brotliSize: true,
      })] : []),
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
      // Analyze/debug builds are deliberately outside dist so neither a treemap
      // nor a source map can be published by the normal Netlify/Vercel build.
      outDir: analyze
        ? 'bundle-analysis/analyze-dist'
        : debug
          ? 'bundle-analysis/debug-dist'
          : 'dist',
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
              if (id.includes('ethers')) {
                return 'vendor-ethers';
              }
              if (id.includes('recharts')) {
                return 'vendor-recharts';
              }
              if (id.includes('d3-scale') || id.includes('react-simple-maps')) {
                return 'vendor-maps';
              }
              if (id.includes('@supabase/')) {
                return 'vendor-supabase';
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
      // Source maps expose the full source tree. Production ships none; use
      // `npm run build:debug` to keep a map-bearing build under
      // bundle-analysis/debug-dist for local debugging or a Sentry CLI upload.
      sourcemap: debug,
    },
  };
});
