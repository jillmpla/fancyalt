// routes/status.js

const express = require('express');

const router = express.Router();

router.get('/status', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    res.status(200).json({
        status: 'ok',
        service: 'FancyAlt API',
        version: process.env.APP_VERSION || '2.0.0',
        provider: 'OpenAI',
        environment: process.env.NODE_ENV || 'development',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
