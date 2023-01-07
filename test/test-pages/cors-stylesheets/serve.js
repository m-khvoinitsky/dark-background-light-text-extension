#!/usr/bin/node

const { serve } = require('../simple-node-server');

const ports = [8080, 8081, 8082, 8083];

ports.forEach((port) =>
  serve({
    port,
    mutateHeaders({ headers, request }) {
      if (request.url.endsWith('.woff2')) {
        // eslint-disable-next-line no-param-reassign
        headers['Access-Control-Allow-Origin'] = '*';
      }
      return headers;
    },
    // eslint-disable-next-line no-unused-vars
    mutateFilePath: ({ filePath, request, bind_address }) =>
      `./${port}${filePath}`,
  }),
);
