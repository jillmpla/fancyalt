// services/imageModerator.js

const openai = require('./openaiClient');
const { getImageUrl } = require('./imageInput');

const {
    AppError,
    UnprocessableEntityError,
} = require('../utils/errors');

const MODERATION_MODEL =
    process.env.OPENAI_MODERATION_MODEL ||
    'omni-moderation-latest';

/**
 * Moderates an uploaded image or public image URL.
 */
async function moderateImage({ image }) {
    const imageUrl = getImageUrl(image);

    try {
        const response = await openai.moderations.create({
            model: MODERATION_MODEL,

            input: [
                {
                    type: 'image_url',
                    image_url: {
                        url: imageUrl,
                    },
                },
            ],
        });

        const result = response.results?.[0];

        if (!result) {
            const emptyResultError = new Error(
                'OpenAI did not return a moderation result.'
            );

            emptyResultError.code =
                'EMPTY_MODERATION_RESULT';

            throw emptyResultError;
        }

        return normalizeModerationResult(
            result,
            response.model || MODERATION_MODEL
        );
    } catch (error) {
        logModerationError(error);

        throw createModerationError(error);
    }
}

function normalizeModerationResult(result, model) {
    const categories =
        normalizeObject(result.categories);

    const categoryScores =
        normalizeObject(result.category_scores);

    const appliedInputTypes =
        normalizeObject(
            result.category_applied_input_types
        );

    const flaggedCategories =
        Object.entries(categories)
            .filter(([, flagged]) => flagged === true)
            .map(([category]) => category);

    return {
        flagged: Boolean(result.flagged),
        flaggedCategories,
        categories,
        categoryScores,
        appliedInputTypes,
        model,
    };
}

function normalizeObject(value) {
    if (!value || typeof value !== 'object') {
        return {};
    }

    return { ...value };
}

function createModerationError(error) {
    const status = Number(error?.status) || 0;

    if (status === 400 || status === 422) {
        return new UnprocessableEntityError(
            'The image could not be moderated. It may be inaccessible, corrupt, or unsupported.'
        );
    }

    if (status === 429) {
        const message = isUsageLimitError(error)
            ? 'Image analysis is temporarily unavailable because the OpenAI service usage limit was reached.'
            : 'The image safety service is temporarily rate-limited. Please wait and try again.';

        return createServiceUnavailableError(
            message,
            getRetryAfterSeconds(error)
        );
    }

    if (status === 401 || status === 403) {
        return createServiceUnavailableError(
            'The image safety service is temporarily unavailable because its server configuration could not be authenticated.'
        );
    }

    if (
        status >= 500 ||
        isConnectionError(error)
    ) {
        return createServiceUnavailableError(
            'The image safety service is temporarily unavailable. Please try again shortly.',
            getRetryAfterSeconds(error)
        );
    }

    if (error?.code === 'EMPTY_MODERATION_RESULT') {
        return createUpstreamResponseError(
            'The image safety service returned an invalid response.'
        );
    }

    return createUpstreamResponseError(
        'The image safety check could not be completed.'
    );
}

function createServiceUnavailableError(
    message,
    retryAfterSeconds = 30
) {
    const error = new AppError(message, 503);

    error.name = 'ServiceUnavailableError';
    error.isOperational = true;
    error.retryAfterSeconds =
        retryAfterSeconds;

    return error;
}

function createUpstreamResponseError(message) {
    const error = new AppError(message, 502);

    error.name = 'BadGatewayError';
    error.isOperational = true;

    return error;
}

function isUsageLimitError(error) {
    const searchableText = [
        error?.message,
        error?.code,
        error?.type,
        error?.error?.message,
        error?.error?.code,
        error?.error?.type,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return (
        searchableText.includes('insufficient_quota') ||
        searchableText.includes('usage limit') ||
        searchableText.includes('billing') ||
        searchableText.includes('quota')
    );
}

function isConnectionError(error) {
    return [
        'ECONNABORTED',
        'ECONNRESET',
        'ENOTFOUND',
        'ETIMEDOUT',
    ].includes(error?.code);
}

function getRetryAfterSeconds(error) {
    const retryAfter =
        getHeader(error?.headers, 'retry-after');

    const parsedSeconds =
        Number.parseInt(retryAfter, 10);

    if (
        Number.isInteger(parsedSeconds) &&
        parsedSeconds > 0
    ) {
        return Math.min(parsedSeconds, 300);
    }

    return 30;
}

function getHeader(headers, name) {
    if (!headers) {
        return null;
    }

    if (typeof headers.get === 'function') {
        return headers.get(name);
    }

    return (
        headers[name] ??
        headers[name.toLowerCase()] ??
        null
    );
}

function logModerationError(error) {
    console.error(
        'OpenAI image moderation failed:',
        {
            status: error?.status ?? null,

            code:
                error?.code ??
                error?.error?.code ??
                null,

            type:
                error?.type ??
                error?.error?.type ??
                null,

            message:
                error?.message ??
                'Unknown moderation error',

            providerRequestId:
                error?.request_id ??
                getHeader(
                    error?.headers,
                    'x-request-id'
                ) ??
                null,

            retryAfter:
                getHeader(
                    error?.headers,
                    'retry-after'
                ) ??
                null,
        }
    );
}

module.exports = {
    moderateImage,
};
