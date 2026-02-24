const fs = require('fs');
const path = require('path');

/**
 * Middleware to intercept HTML requests and inject CSP nonce
 * This allows serving static HTML files with strict CSP enabled
 */
const cspStaticMiddleware = (publicDir) => {
    return (req, res, next) => {
        // Only intercept GET requests
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }

        // Determine file path
        let requestPath = req.path;

        // Handle root path
        if (requestPath === '/') {
            requestPath = '/index.html';
        }

        // Only handle HTML files
        if (!requestPath.endsWith('.html')) {
            return next();
        }

        // prevent path traversal
        const safePath = path.normalize(requestPath).replace(/^(\.\.[\/\\])+/, '');
        const filePath = path.join(publicDir, safePath);

        // Check if file exists within public dir
        if (!filePath.startsWith(path.resolve(publicDir))) {
            return next();
        }

        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                // File not found, let express.static or 404 handler handle it
                return next();
            }

            // Read file
            fs.readFile(filePath, 'utf8', (err, content) => {
                if (err) {
                    return next(err);
                }

                const nonce = res.locals.cspNonce;

                if (!nonce) {
                    // No nonce available, serve as is (or next)
                    // But strict CSP header is already set, so this will fail.
                    // Should not happen if securityHeaders is used.
                    return res.send(content);
                }

                // Inject nonce into script and style tags
                // This is a simple regex replacement. 
                // For production usage with complex HTML, a parser would be better,
                // but for this specific application structure, regex is sufficient.
                const injected = content
                    .replace(/<script/gi, `<script nonce="${nonce}"`)
                    .replace(/<style/gi, `<style nonce="${nonce}"`);

                // Set content type
                res.setHeader('Content-Type', 'text/html; charset=UTF-8');

                // Send response
                res.send(injected);
            });
        });
    };
};

module.exports = cspStaticMiddleware;
