#!/usr/bin/node

const { serve } = require('../simple-node-server');

serve({
  port: 8080,
  mutateHeaders: function ({ headers, request }) {
    headers['Content-Security-Policy'] = "default-src 'self'";
    return headers;
  },
  mutateFilePath: ({ filePath, request, bind_address }) =>
    `./webroot${filePath}`,
});
