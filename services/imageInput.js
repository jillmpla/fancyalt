// services/imageInput.js

const { BadRequestError } = require('../utils/errors');

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

function getImageUrl(image) {
    if (!image || typeof image !== 'object') {
        throw new BadRequestError('A valid image source is required.');
    }

    if (image.url) {
        return validateRemoteUrl(image.url);
    }

    if (image.buffer) {
        return createDataUrl(image);
    }

    throw new BadRequestError(
        'The image source must contain either a URL or an uploaded image buffer.'
    );
}

function createDataUrl(image) {
    if (!Buffer.isBuffer(image.buffer)) {
        throw new BadRequestError('The uploaded image data is invalid.');
    }

    if (!ALLOWED_MIME_TYPES.has(image.mimeType)) {
        throw new BadRequestError(
            'Only JPEG, PNG, and WEBP images are supported.'
        );
    }

    const base64Image = image.buffer.toString('base64');

    return `data:${image.mimeType};base64,${base64Image}`;
}

function validateRemoteUrl(value) {
    let parsedUrl;

    try {
        parsedUrl = new URL(value);
    } catch {
        throw new BadRequestError('A valid image URL is required.');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new BadRequestError(
            'The image URL must use HTTP or HTTPS.'
        );
    }

    return parsedUrl.toString();
}

module.exports = {
    getImageUrl,
};