import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true
  },
  assetsInclude: ['**/*.mind', '**/*.mp4', '**/*.webm', '**/*.jpg', '**/*.png'],
  plugins: [
    {
      name: 'save-mind-target-endpoint',
      configureServer(server) {
        server.middlewares.use('/__save_mind', (req, res) => {
          if (req.method === 'POST') {
            const chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => {
              const buf = Buffer.concat(chunks);
              fs.mkdirSync('targets', { recursive: true });
              fs.writeFileSync('targets/event-poster.mind', buf);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, bytes: buf.length }));
            });
          } else {
            res.writeHead(405);
            res.end();
          }
        });
      }
    }
  ],
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        poster: resolve(__dirname, 'poster.html'),
        compiler: resolve(__dirname, 'compiler.html')
      }
    }
  }
});
