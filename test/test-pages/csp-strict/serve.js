#!/usr/bin/node

const connect = require('connect');
const serve_static = require('serve-static');
const path = require('path');

[
    '127.0.0.1',
    '::1',
].forEach(bind => {
    [
        8080,
    ].forEach(port => {
        connect().use(serve_static(path.join(__dirname, 'webroot'), {
            setHeaders: (res, path, stat) => {
                res.setHeader('Content-Security-Policy', "default-src 'self'");
            },
        })).listen(port, bind, function(){
            console.log(`Server listening [${bind}]:${port}...`);
        });
    });
});
