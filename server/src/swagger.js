const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'call-audit-agent server', version: '1.0.0' },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  // Absolute, based on this file's own location — a cwd-relative glob breaks
  // under Vercel, where process.cwd() doesn't reliably match the project root.
  // Forward slashes always, since the glob matcher treats '\' as an escape
  // character even on Windows.
  apis: [path.join(__dirname, 'routes', '*.js').split(path.sep).join('/')],
});

module.exports = spec;
