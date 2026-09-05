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
        // Guard: Block public access to any pages other than the camera page (index.html)
        server.middlewares.use((req, res, next) => {
          const pathname = req.url.split('?')[0].toLowerCase();
          if (pathname.endsWith('.html') && pathname !== '/' && pathname !== '/index.html') {
            // Allow internal tools on localhost only when needed for target compilation
            if (pathname.startsWith('/tools/')) {
              return next();
            }
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found — Only the WebAR camera experience is publicly accessible.');
            return;
          }
          next();
        });

        server.middlewares.use('/__save_mind', (req, res) => {
          if (req.method === 'POST') {
            const urlObj = new URL(req.url, 'http://localhost');
            const targetName = urlObj.searchParams.get('name') || 'poster.mind';
            const chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => {
              const buf = Buffer.concat(chunks);
              fs.mkdirSync('targets', { recursive: true });
              fs.mkdirSync('public/targets', { recursive: true });
              fs.writeFileSync(`targets/${targetName}`, buf);
              fs.writeFileSync(`public/targets/${targetName}`, buf);
              console.log(`Saved target to targets/${targetName} and public/targets/${targetName} (${buf.length} bytes)`);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, bytes: buf.length, target: targetName }));
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
        main: resolve(__dirname, 'index.html')
      }
    }
  }
});
