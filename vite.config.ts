import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
    plugins: [react()],
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
    // chunker tree-shakes per export, so we intentionally omit manualChunks.
  };
});
