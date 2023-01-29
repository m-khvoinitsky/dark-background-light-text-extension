#!/usr/bin/node

const { serve } = require('../simple-node-server');

serve({
  port: 8080,
  // eslint-disable-next-line no-unused-vars
  mutateHeaders({ headers, request }) {
    // eslint-disable-next-line no-param-reassign
    headers['Content-Security-Policy'] = "default-src 'self'";
    return headers;
  },
  // eslint-disable-next-line no-unused-vars
  mutateFilePath: ({ filePath, request, bind_address }) =>
    `./webroot${filePath}`,
});
