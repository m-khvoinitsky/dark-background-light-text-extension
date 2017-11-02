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
        8081,
        8082,
        8083,
    ].forEach(port => {
        connect().use(serve_static(path.join(__dirname, `${port}`), {
            setHeaders: (res, path, stat) => {
                if (path.indexOf('.woff2') >= 0)
                    res.setHeader('Access-Control-Allow-Origin', '*');
            },
        })).listen(port, bind, function(){
            console.log(`Server listening [${bind}]:${port}...`);
        });
    });
});
