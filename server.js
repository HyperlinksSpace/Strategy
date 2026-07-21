#!/usr/bin/env node
/**
 * Strategy site + AI composer gateway (Railway / local).
 * Serves static SPA and POST /api/ai (TinyModel plan + Vercel AI Gateway).
 */

var http = require('http');
var path = require('path');
var express = require('express');
var aiHandler = require('./api/ai');

var ROOT = __dirname;
var PORT = Number(process.env.PORT || 3000);
var HOST = process.env.HOST || '0.0.0.0';

var app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', function (req, res) {
  res.json({
    status: 'ok',
    service: 'strategy-ai-gateway',
    tinymodel: process.env.TINYMODEL_API_URL || 'https://tinymodel.hyperlinks.space',
    composer: process.env.AI_PROVIDER || 'hybrid',
    gateway: !!(process.env.AI_GATEWAY_API_KEY && process.env.AI_GATEWAY_API_KEY.trim())
  });
});

function forwardAi(req, res) {
  aiHandler(req, res).catch(function (err) {
    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        error: String(err && err.message ? err.message : err)
      });
    }
  });
}

app.options('/api/ai', forwardAi);
app.get('/api/ai', forwardAi);
app.post('/api/ai', forwardAi);

app.use(express.static(ROOT, { index: 'index.html', extensions: ['html'] }));

app.get('*', function (req, res, next) {
  if (req.path.indexOf('/api/') === 0) return next();
  res.sendFile(path.join(ROOT, 'index.html'));
});

var server = http.createServer(app);
server.listen(PORT, HOST, function () {
  console.log('Strategy AI gateway listening on http://' + HOST + ':' + PORT);
});
