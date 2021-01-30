#!/usr/bin/node

const { serve } = require('../simple-node-server');

const ports = [8080, 8081, 8082, 8083];

ports.forEach((port) =>
  serve({
    port,
    mutateHeaders: function ({ headers, request }) {
      if (request.url.endsWith('.woff2')) {
        headers['Access-Control-Allow-Origin'] = '*';
      }
      return headers;
    },
    mutateFilePath: ({ filePath, request, bind_address }) =>
      `./${port}${filePath}`,
  })
);
