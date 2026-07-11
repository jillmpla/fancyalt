// services/openaiClient.js

const OpenAI = require('openai');

if (!process.env.OPENAI_API_KEY) {
    throw new Error(
        'OPENAI_API_KEY is missing. Add it to your environment variables.'
    );
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 60_000,
    maxRetries: 0,
});

module.exports = openai;
