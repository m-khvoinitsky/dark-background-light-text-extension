#!/usr/bin/node

const { serve } = require('../simple-node-server');

const ports = [8080, 8081];

ports.forEach((port) =>
  serve({
    port,
    mutateFilePath: ({ filePath, request, bind_address }) =>
      `./${port}${filePath}`,
  })
);
