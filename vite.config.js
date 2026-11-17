import { defineConfig } from 'vite';
import fan from './api/fan.js';

// On Vercel, files in /api run as serverless functions. This plugin serves the same
// handlers from the local dev and preview servers so the live panel works locally too.
const API_ROUTES = {
  '/api/fan': fan,
};

function localApi() {
  const mount = (server) => {
    for (const [route, handler] of Object.entries(API_ROUTES)) {
      server.middlewares.use(route, (req, res) => {
        Promise.resolve(handler(req, res)).catch(() => {
          res.statusCode = 500;
          res.end('{}');
        });
      });
    }
  };
  return { name: 'local-api', configureServer: mount, configurePreviewServer: mount };
}

// Social previews need absolute image URLs. Vercel exposes the production domain at build time;
// locally the tags fall back to relative paths.
function siteUrl() {
  return {
    name: 'site-url',
    transformIndexHtml(html) {
      const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
      return html.replaceAll('__SITE_URL__', host ? `https://${host}` : '');
    },
  };
}

export default defineConfig({
  plugins: [localApi(), siteUrl()],
});
