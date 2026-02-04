// Proxy simples para evitar CORS ao acessar Xtream/M3U
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

// Permitir qualquer origem (apenas para desenvolvimento)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Rota: /proxy?url=https://...
app.use('/proxy', (req, res, next) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Informe ?url=' });
  createProxyMiddleware({
    target: url,
    changeOrigin: true,
    router: () => url,
    pathRewrite: (_path, _req) => '',
    onProxyReq: (proxyReq) => {
      // Nada por enquanto
    }
  })(req, res, next);
});

const port = process.env.PORT || 8081;
const log = (level, msg, meta) => {
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn('[SIMPLE-PROXY]', { ts: new Date().toISOString(), level, msg, ...(meta ? { meta } : null) });
};

app.listen(port, () => log('info', 'startup', { port, url: `http://localhost:${port}` }));
