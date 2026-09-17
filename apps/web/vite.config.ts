import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](?:react|react-dom|react-router-dom)[\\/]/,
              priority: 30,
            },
            {
              name: 'antd-vendor',
              test: /node_modules[\\/](?:antd|@ant-design|rc-)/,
              priority: 20,
              maxSize: 420_000,
            },
            {
              name: 'data-vendor',
              test: /node_modules[\\/](?:@tanstack|react-hook-form|zod)[\\/]/,
              priority: 10,
            },
            {
              name: 'vendor',
              test: /node_modules/,
              maxSize: 380_000,
            },
          ],
        },
      },
    },
  },
});
