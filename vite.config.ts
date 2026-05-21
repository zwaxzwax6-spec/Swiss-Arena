import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Mirror the production Vercel rewrites for `vite dev` / `vite preview`:
// serve the React entry (app.html) for SPA routes while keeping the static
// landing (index.html) on /.
const SPA_ROUTES = ['/commander', '/confirmation', '/admin']
function spaFallback(): Plugin {
  const handler = (req: any, _res: any, next: () => void) => {
    const path = (req.url || '').split('?')[0]
    if (SPA_ROUTES.some((r) => path === r || path.startsWith(r + '/'))) {
      req.url = '/app.html'
    }
    next()
  }
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

export default defineConfig({
  plugins: [react(), spaFallback()],
  build: {
    rollupOptions: {
      input: {
        app: 'app.html',
      },
    },
  },
})
