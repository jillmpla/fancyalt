// routes/caption.js

const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');

const { analyzeImage } = require('../services/imageAnalyzer');
const { moderateImage } = require('../services/imageModerator');
const { generateStory } = require('../services/storyGenerator');

const {
    BadRequestError,
    UnsupportedMediaTypeError,
} = require('../utils/errors');

const validate = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');

const router = express.Router();

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

const ALLOWED_MODES = [
    'concise',
    'detailed',
    'social',
    'story',
    'moderateOnly',
];

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: 1,
    },

    fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            return callback(
                new UnsupportedMediaTypeError(
                    'Only JPEG, PNG, and WEBP image files are allowed.'
                )
            );
        }

        return callback(null, true);
    },
});

function createUploadedImageSource(file) {
    return {
        buffer: file.buffer,
        mimeType: file.mimetype,
        filename: file.originalname,
    };
}

function validateImageUrl(value) {
    let parsedUrl;

    try {
        parsedUrl = new URL(value);
    } catch {
        throw new Error('A valid image URL is required.');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error(
            'The image URL must use HTTP or HTTPS.'
        );
    }

    if (
        parsedUrl.hostname === 'localhost' ||
        parsedUrl.hostname === '127.0.0.1' ||
        parsedUrl.hostname === '::1'
    ) {
        throw new Error(
            'Local image URLs are not allowed.'
        );
    }

    return true;
}

const sharedAnalysisValidators = [
    body('mode')
        .optional()
        .isIn(ALLOWED_MODES)
        .withMessage(
            `Mode must be one of: ${ALLOWED_MODES.join(', ')}.`
        ),

    body('maxLength')
        .optional()
        .isInt({
            min: 40,
            max: 1000,
        })
        .withMessage(
            'maxLength must be between 40 and 1,000 characters.'
        )
        .toInt(),

    body('includeVisibleText')
        .optional()
        .isBoolean()
        .withMessage(
            'includeVisibleText must be true or false.'
        )
        .toBoolean(),
];

async function processImage({
    image,
    mode,
    maxLength,
    includeVisibleText,
    imageUrl,
}) {
    /*
     * The moderation endpoint is called for every image.
     * It does not generate description content.
     */
    const moderation =
        await moderateImage({ image });

    const baseResponse = {
        mode,
        ...(imageUrl ? { imageUrl } : {}),
        flagged: moderation.flagged,
        moderation,
    };

    /*
     * Moderation-only mode stops here.
     */
    if (mode === 'moderateOnly') {
        return baseResponse;
    }

    /*
     * Exactly one mode-specific API request is
     * made for each non-moderation request.
     */
    const output =
        mode === 'story'
            ? await generateStory({
                image,
                maxLength,
                includeVisibleText,
            })
            : await analyzeImage({
                image,
                mode,
                maxLength,
                includeVisibleText,
            });

    return {
        ...baseResponse,
        output,
    };
}

/**
 * POST /api/generate-caption
 *
 * Accepts multipart/form-data:
 * - image: required
 * - mode: optional; defaults to concise
 * - maxLength: optional
 * - includeVisibleText: optional
 */
router.post(
    '/generate-caption',
    upload.single('image'),
    sharedAnalysisValidators,
    validate,
    asyncHandler(async (req, res) => {
        if (!req.file) {
            throw new BadRequestError(
                'An image file is required.'
            );
        }

        const result = await processImage({
            image:
                createUploadedImageSource(
                    req.file
                ),

            mode:
                req.body.mode ||
                'concise',

            maxLength:
                req.body.maxLength ||
                null,

            includeVisibleText:
                req.body.includeVisibleText ??
                true,
        });

        return res.status(200).json(result);
    })
);

/**
 * POST /api/analyze-url
 *
 * Accepts JSON:
 * {
 *   "imageUrl": "https://example.com/image.jpg",
 *   "mode": "concise",
 *   "maxLength": 160,
 *   "includeVisibleText": true
 * }
 */
router.post(
    '/analyze-url',
    [
        body('imageUrl')
            .exists({ checkFalsy: true })
            .withMessage(
                'imageUrl is required.'
            )
            .bail()
            .isString()
            .withMessage(
                'imageUrl must be text.'
            )
            .bail()
            .custom(validateImageUrl),

        ...sharedAnalysisValidators,
    ],
    validate,
    asyncHandler(async (req, res) => {
        const result = await processImage({
            image: {
                url: req.body.imageUrl,
            },

            imageUrl:
                req.body.imageUrl,

            mode:
                req.body.mode ||
                'concise',

            maxLength:
                req.body.maxLength ||
                null,

            includeVisibleText:
                req.body.includeVisibleText ??
                true,
        });

        return res.status(200).json(result);
    })
);

module.exports = router;
