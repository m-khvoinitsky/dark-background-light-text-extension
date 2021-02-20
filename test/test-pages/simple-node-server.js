// based on
// https://developer.mozilla.org/en-US/docs/Learn/Server-side/Node_server_without_framework

const { createServer } = require('http');
const fs = require('fs').promises;
const get_extname = require('path').extname;

console.log(
    'This server must be used only for testing with trusted code. Do not use it on production or anywhere except for localhost!',
);

exports.serve = ({
    port = 8080,
    mutateHeaders,
    mutateFilePath,
    index = 'index.html',
}) => {
    const IPs = ['127.0.0.1', '::1'];

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
        createServer(async (request, response) => {
            let filePath = request.url;
            if (index && filePath.endsWith('/')) {
                filePath += index;
            }
            if (mutateFilePath) {
                filePath = mutateFilePath({
                    filePath,
                    request,
                    bind_address: bind_to,
                });
            }
            console.log(`${request.method} ${filePath}`);

            const extname = String(get_extname(filePath)).toLowerCase();

            const contentType = mimeTypes[extname] || 'application/octet-stream';

            let body;
            let code;
            try {
                // no security precautions here, use only for testing with trusted code!
                body = await fs.readFile(filePath);
                code = 200;
            } catch (e) {
                console.error(e);
                body = '404 Not Found';
                code = 404;
            }

            let headers = {
                'Content-Type': contentType,
            };
            if (mutateHeaders) {
                headers = mutateHeaders({
                    headers,
                    request,
                });
            }

            response.writeHead(code, headers);
            response.end(body, 'utf-8');
        }).listen(port, bind_to);
        console.log(
            `Server running at http://${
                bind_to.indexOf(':') >= 0 ? `[${bind_to}]` : bind_to
            }:${port}/`,
        );
    });
};
