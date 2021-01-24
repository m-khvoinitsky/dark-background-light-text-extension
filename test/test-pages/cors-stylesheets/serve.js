#!/usr/bin/node

// based on
// https://developer.mozilla.org/en-US/docs/Learn/Server-side/Node_server_without_framework

const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const IPs = ['127.0.0.1', '::1'];
const ports = [
  8080,
  8081,
  8082,
  8083,
];

console.log(
  'This server must be used only for testing with trusted code. Do not use it on production or anywhere except for localhost!',
);

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm',
};

IPs.forEach((bind_to) => {
  ports.forEach((listen_on) => {
    http
      .createServer(async function (request, response) {
        // no security precautions here, use only for testing with trusted code!
        var filePath = `./${listen_on}` + request.url;
        if (filePath.endsWith('/')) {
          filePath += 'index.html';
        }
        console.log(filePath);

        var extname = String(path.extname(filePath)).toLowerCase();

        var contentType = mimeTypes[extname] || 'application/octet-stream';

        let body;
        let code;
        try {
          body = await fs.readFile(filePath);
          code = 200;
        } catch (e) {
          console.error(e);
          body = '404 Not Found';
          code = 404;
        }

        let headers = {
          'Content-Type': contentType,
        }
        if (request.url.endsWith('.woff2')) {
          headers['Access-Control-Allow-Origin'] = '*';
        }

        response.writeHead(code, headers);
        response.end(body, 'utf-8');
      })
      .listen(listen_on, bind_to);
    console.log(
      `Server running at http://${
        bind_to.indexOf(':') >= 0 ? `[${bind_to}]` : bind_to
      }:${listen_on}/`,
    );
  });
});
