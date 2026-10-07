import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The screens are written with React Native components; react-native-web
// renders them as normal HTML in the browser.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // RN libraries ship *.web.js files for the browser; prefer them.
    extensions: ['.web.js', '.web.jsx', '.js', '.jsx', '.mjs', '.json'],
    alias: [{ find: /^react-native$/, replacement: 'react-native-web' }],
  },
  // Same preference for the dev-server dependency pre-bundler.
  optimizeDeps: { esbuildOptions: { resolveExtensions: ['.web.js', '.js', '.jsx', '.mjs', '.json'] } },
});
