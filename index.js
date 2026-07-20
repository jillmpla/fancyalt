// index.js

require('dotenv').config({
    quiet: true,
});

const crypto = require('crypto');
const path = require('path');

const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const YAML = require('yamljs');

const sanitizeInput = require('./middlewares/sanitizeKeys');

const {
    AppError,
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    PayloadTooLargeError,
} = require('./utils/errors');

// Check required environment variables.
validateEnvironment();

const captionRoute = require('./routes/caption');
const statusRoute = require('./routes/status');

const app = express();

const PORT = Number.parseInt(process.env.PORT, 10) || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

const PUBLIC_DIRECTORY = path.join(__dirname, 'public');
const SWAGGER_PATH = path.join(__dirname, 'swagger.yaml');

// Support a trusted hosting proxy when configured.
if (process.env.TRUST_PROXY) {
    app.set(
        'trust proxy',
        Number.parseInt(process.env.TRUST_PROXY, 10) || 1
    );
}

// Hide the Express header.
app.disable('x-powered-by');

// Add a request ID to each request.
app.use((req, res, next) => {
    const suppliedRequestId = req.get('x-request-id');

    const isValidRequestId =
        typeof suppliedRequestId === 'string' &&
        suppliedRequestId.length <= 100 &&
        /^[A-Za-z0-9._:-]+$/.test(suppliedRequestId);

    req.requestId = isValidRequestId
        ? suppliedRequestId
        : crypto.randomUUID();

    res.setHeader('X-Request-ID', req.requestId);

    next();
});

// Add security headers.
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: {
            policy: 'cross-origin',
        },
    })
);

// Set allowed website origins.
const allowedOrigins = getAllowedOrigins();

app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(
                new ForbiddenError(
                    'Requests from this origin are not allowed.'
                )
            );
        },

        methods: [
            'GET',
            'POST',
            'OPTIONS',
        ],

        allowedHeaders: [
            'Content-Type',
            'X-Request-ID',
        ],

        exposedHeaders: [
            'X-Request-ID',
            'RateLimit',
            'RateLimit-Policy',
        ],

        credentials: false,
        optionsSuccessStatus: 204,
    })
);

// Parse request bodies.
app.use(
    express.json({
        limit: '1mb',
        strict: true,
    })
);

app.use(
    express.urlencoded({
        extended: false,
        limit: '1mb',
    })
);

// Remove unsafe request keys.
app.use(sanitizeInput);

// Limit API requests.
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 25,
    standardHeaders: 'draft-7',
    legacyHeaders: false,

    message: {
        error:
            'Rate limit exceeded. Please wait and try again shortly.',
    },

    handler(req, res, _next, options) {
        return res.status(options.statusCode).json({
            error:
                'Rate limit exceeded. Please wait and try again shortly.',
            requestId: req.requestId,
        });
    },
});

app.use('/api', apiLimiter);

// Prevent API response caching.
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

// Load the OpenAPI document.
const swaggerDocument = YAML.load(SWAGGER_PATH);

// Safely embed the OpenAPI document in the documentation page.
const swaggerDocumentJson = JSON.stringify(swaggerDocument)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

// Render the Swagger documentation page.
function renderApiDocs(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    res.type('html').send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1"
            >

            <title>FancyAlt API Docs</title>

            <link rel="icon" href="/favicon-new.ico?v=2">

            <link
                rel="stylesheet"
                href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.8/swagger-ui.css"
            >

            <link
                rel="stylesheet"
                href="/swagger-custom.css"
            >
        </head>

        <body>
            <div id="swagger-ui"></div>

            <script
                src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.8/swagger-ui-bundle.js"
            ></script>

            <script
                src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.8/swagger-ui-standalone-preset.js"
            ></script>

            <script>
                window.ui = SwaggerUIBundle({
                    spec: ${swaggerDocumentJson},
                    dom_id: '#swagger-ui',
                    deepLinking: true,
                    presets: [
                        SwaggerUIBundle.presets.apis,
                        SwaggerUIStandalonePreset,
                    ],
                    layout: 'StandaloneLayout',
                });
            </script>
        </body>
        </html>
    `);
}

// Serve the same page with or without a trailing slash.
app.get(
    [
        '/api-docs',
        '/api-docs/',
    ],
    renderApiDocs
);

// Serve the raw Swagger file.
app.get('/swagger.yaml', (req, res) => {
    res.setHeader('Content-Type', 'application/yaml');
    res.setHeader('Cache-Control', 'no-store');

    res.sendFile(SWAGGER_PATH);
});

// Keep the old docs link working.
app.get('/docs', (req, res) => {
    res.redirect(301, '/api-docs/');
});

// Serve public files.
app.use(
    express.static(PUBLIC_DIRECTORY, {
        index: false,
        maxAge: NODE_ENV === 'production' ? '1h' : 0,
        etag: true,
    })
);

// Serve the main page.
app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');

    res.sendFile(
        path.join(PUBLIC_DIRECTORY, 'index.html')
    );
});

// Register API routes.
app.use('/api', captionRoute);
app.use('/api', statusRoute);

// Also support GET /status for direct browser checks.
app.use(statusRoute);

// Handle unknown routes.
app.use((req, res, next) => {
    next(
        new NotFoundError(
            `Route not found: ${req.method} ${req.originalUrl}`
        )
    );
});

// Handle all application errors.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    const normalizedError = normalizeError(error);

    logError(normalizedError, req);

    const isProduction = NODE_ENV === 'production';

    const safeMessage =
        normalizedError.isOperational || !isProduction
            ? normalizedError.message
            : 'Internal Server Error';

    if (
        Number.isInteger(normalizedError.retryAfterSeconds) &&
        normalizedError.retryAfterSeconds > 0
    ) {
        res.setHeader(
            'Retry-After',
            String(normalizedError.retryAfterSeconds)
        );
    }

    const response = {
        error: safeMessage,
        requestId: req.requestId,
    };

    if (normalizedError.details) {
        response.details = normalizedError.details;
    }

    if (!isProduction && normalizedError.stack) {
        response.stack = normalizedError.stack;
    }

    return res
        .status(normalizedError.statusCode || 500)
        .json(response);
});

// Start the server when this file runs directly.
if (require.main === module) {
    const server = app.listen(PORT, HOST, () => {
        console.log(
            `FancyAlt API running in ${NODE_ENV} mode at http://${HOST}:${PORT}`
        );

        console.log('[ENV CHECK]', {
            OPENAI_API_KEY: '✔ loaded',

            OPENAI_IMAGE_MODEL:
                process.env.OPENAI_IMAGE_MODEL ||
                'gpt-5.4-mini',

            OPENAI_STORY_MODEL:
                process.env.OPENAI_STORY_MODEL ||
                'gpt-5.4-mini',

            OPENAI_MODERATION_MODEL:
                process.env.OPENAI_MODERATION_MODEL ||
                'omni-moderation-latest',
        });
    });

    registerShutdownHandlers(server);
}

module.exports = app;

// Check required settings.
function validateEnvironment() {
    const missingVariables = [];

    if (!process.env.OPENAI_API_KEY) {
        missingVariables.push('OPENAI_API_KEY');
    }

    if (missingVariables.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missingVariables.join(', ')}`
        );
    }
}

// Build the allowed CORS origin list.
function getAllowedOrigins() {
    const defaultOrigins = [
        'https://fancyalt.com',
        'https://www.fancyalt.com',
        'http://fancyalt.com',
        'http://localhost:3000',
        'http://localhost:5000',
    ];

    const configuredOrigins = (
        process.env.CORS_ORIGINS || ''
    )
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    return [
        ...new Set([
            ...defaultOrigins,
            ...configuredOrigins,
        ]),
    ];
}

// Convert errors to the app error format.
function normalizeError(error) {
    if (error instanceof AppError) {
        return error;
    }

    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return new PayloadTooLargeError(
                'File size exceeds the 5MB limit.'
            );
        }

        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return new BadRequestError(
                'Only one image may be uploaded using the "image" field.'
            );
        }

        return new BadRequestError(
            'The image upload could not be processed.',
            {
                uploadCode: error.code,
            }
        );
    }

    if (
        error instanceof SyntaxError &&
        error.status === 400 &&
        Object.prototype.hasOwnProperty.call(error, 'body')
    ) {
        return new BadRequestError(
            'The request contains invalid JSON.'
        );
    }

    const unexpectedError = new AppError(
        error?.message || 'Internal Server Error',
        500
    );

    unexpectedError.isOperational = false;
    unexpectedError.stack =
        error?.stack || unexpectedError.stack;

    return unexpectedError;
}

// Log errors without logging request data.
function logError(error, req) {
    const logEntry = {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: error.statusCode || 500,
        error: error.name,
        message: error.message,
    };

    if (
        error.statusCode >= 500 ||
        !error.isOperational
    ) {
        console.error('[REQUEST ERROR]', {
            ...logEntry,
            stack: error.stack,
        });

        return;
    }

    console.warn('[REQUEST WARNING]', logEntry);
}

// Close the server safely.
function registerShutdownHandlers(httpServer) {
    let shuttingDown = false;

    function shutdown(signal) {
        if (shuttingDown) {
            return;
        }

        shuttingDown = true;

        console.log(
            `${signal} received. Closing the HTTP server...`
        );

        const forceShutdownTimer = setTimeout(() => {
            console.error(
                'Server shutdown timed out. Exiting.'
            );

            process.exit(1);
        }, 10_000);

        forceShutdownTimer.unref();

        httpServer.close((error) => {
            clearTimeout(forceShutdownTimer);

            if (error) {
                console.error(
                    'Failed to close the HTTP server:',
                    error
                );

                process.exit(1);
            }

            console.log('HTTP server closed.');
            process.exit(0);
        });
    }

    process.once(
        'SIGTERM',
        () => shutdown('SIGTERM')
    );

    process.once(
        'SIGINT',
        () => shutdown('SIGINT')
    );
}