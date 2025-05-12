//index.js
require('dotenv').config();
console.log('[ENV CHECK]', {
  AZURE_KEY: process.env.AZURE_KEY ? '✔ loaded' : '✘ missing',
  AZURE_ENDPOINT: process.env.AZURE_ENDPOINT ? '✔ loaded' : '✘ missing',
  AZURE_REGION: process.env.AZURE_REGION ? '✔ loaded' : '✘ missing',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✔ loaded' : '✘ missing',
});

const express = require('express');
const path = require('path');
const captionRoute = require('./routes/caption');
const statusRoute = require('./routes/status');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const app = express();
const PORT = process.env.PORT || 5000;

//load swagger.yaml
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));

//serve Swagger UI from /api-docs (let swagger-ui-express handle everything)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCssUrl: '/swagger-custom.css', //custom css
  customSiteTitle: 'FancyAlt API Docs',
  customfavIcon: '/favicon.ico',
}));

//raw YAML endpoint (for downloading or linking)
app.get('/swagger.yaml', (req, res) => {
  res.setHeader('Content-Type', 'application/x-yaml');
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.resolve(__dirname, 'swagger.yaml'));
});

//redirect /docs to /api-docs (legacy link support)
app.get('/docs', (req, res) => {
  res.redirect(301, '/api-docs');
});

//disable caching for all responses (HTML, CSS, etc.)
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

//serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

//log when root is hit
app.get('/', (req, res) => {
  const fullPath = path.join(__dirname, 'public', 'index.html');
  console.log('Serving:', fullPath);
  res.sendFile(fullPath);
});

//cleanup uploads folder on startup and daily at midnight
const cleanUploadsFolder = require('./utils/cleanup');
const cron = require('node-cron');
cleanUploadsFolder();
cron.schedule('0 0 * * *', () => {
  cleanUploadsFolder();
});

//middleware - parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//security and input sanitization
const helmet = require('helmet');
const sanitizeInput = require('./middlewares/sanitizeKeys');
app.use(helmet({ contentSecurityPolicy: false })); //disables CSP
app.use(sanitizeInput);

//explicitly remove CSP headers (in case cached or sent elsewhere)
app.use((req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Security-Policy');
  res.removeHeader('X-WebKit-CSP');
  next();
});

//CORS setup
const cors = require('cors');
app.use(cors({
  origin: [
    'https://fancyalt.com',
    'http://fancyalt.com',
    'http://localhost:3000',
    'http://localhost:5000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: false,
}));

//rate limiting
const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: {
    error: 'Rate limit exceeded. Please wait and try again shortly.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

//.env warning
if (!process.env.AZURE_KEY || (!process.env.AZURE_REGION && !process.env.AZURE_ENDPOINT)) {
  console.warn('Missing AZURE_KEY or AZURE_REGION/AZURE_ENDPOINT in your .env file');
}

//API routes
app.use('/api', captionRoute);
app.use('/api', statusRoute);

//404 fallback (after all routes)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

//global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err.stack);
  if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File size exceeds the 5MB limit.'
    });
  }
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
    details: err.details || null
  });
});

//start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`FancyAlt API running on http://0.0.0.0:${PORT}`);
});




