// services/imageAnalyzer.js

const { z } = require('zod');
const {
    zodTextFormat,
} = require('openai/helpers/zod');

const openai = require('./openaiClient');
const { getImageUrl } = require('./imageInput');
const {
    AppError,
    UnprocessableEntityError,
} = require('../utils/errors');

const IMAGE_MODEL =
    process.env.OPENAI_IMAGE_MODEL ||
    'gpt-5.4-mini';

const SUPPORTED_MODES = new Set([
    'concise',
    'detailed',
    'social',
]);

const MODE_INSTRUCTIONS = {
    concise: `
Write concise, natural alt text for a typical webpage.
Focus only on the meaningful subject, action, and setting.
Do not begin with "image of," "picture of," or "photo of."
`,

    detailed: `
Write a complete visual description.
Include meaningful subjects, actions, setting, spatial relationships,
colors, and other important visual details.
Do not make unsupported assumptions.
`,

    social: `
Write a natural, engaging image description for social media.
Clearly describe the meaningful visual content in an accessible,
human tone. Do not add hashtags unless they are visibly present.
`,
};

function createOutputSchema(
    includeVisibleText
) {
    const shape = {
        text: z.string(),
    };

    if (includeVisibleText) {
        shape.containsText =
            z.boolean();

        shape.visibleText =
            z.array(z.string());
    }

    return z.object(shape);
}

function buildInstructions({
    mode,
    maxLength,
    includeVisibleText,
}) {
    const lengthInstruction =
        maxLength
            ? `
Keep the requested text at or below approximately
${maxLength} characters. Prioritize the most important details.
`
            : `
Keep the requested text focused and appropriately concise
for the selected mode.
`;

    const visibleTextInstruction =
        includeVisibleText
            ? `
Also identify meaningful readable text shown in the image.
Return it in visibleText and set containsText accurately.
Do not include incidental or unreadable text.
`
            : `
Do not return visible-text fields.
`;

    return `
You are FancyAlt, an accessibility-focused image description assistant.

Return only the output requested for the selected mode.
The structured field named text must contain that single requested result.

Requirements:

- Describe only visually supported details.
- Do not use the filename as evidence.
- Do not identify unnamed people.
- Do not guess sensitive or unsupported personal attributes.
- Do not add tags, accessibility notes, decorative-image guidance,
  alternate descriptions, stories, or other unrequested content.

Selected mode: ${mode}

${MODE_INSTRUCTIONS[mode]}

${lengthInstruction}

${visibleTextInstruction}
`.trim();
}

async function analyzeImage({
    image,
    mode = 'concise',
    maxLength = null,
    includeVisibleText = true,
}) {
    if (!SUPPORTED_MODES.has(mode)) {
        throw new UnprocessableEntityError(
            'The selected analysis mode is not supported.'
        );
    }

    const imageUrl =
        getImageUrl(image);

    const outputSchema =
        createOutputSchema(
            includeVisibleText
        );

    try {
        const response =
            await openai.responses.parse({
                model: IMAGE_MODEL,
                store: false,

                input: [
                    {
                        role: 'system',

                        content:
                            buildInstructions({
                                mode,
                                maxLength,
                                includeVisibleText,
                            }),
                    },
                    {
                        role: 'user',

                        content: [
                            {
                                type: 'input_text',

                                text:
                                    'Create only the selected output for this image.',
                            },
                            {
                                type: 'input_image',
                                image_url: imageUrl,
                                detail:
                                    mode ===
                                    'detailed'
                                        ? 'high'
                                        : 'low',
                            },
                        ],
                    },
                ],

                text: {
                    format:
                        zodTextFormat(
                            outputSchema,
                            `${mode}_image_output`
                        ),
                },
            });

        if (!response.output_parsed) {
            throw new Error(
                'OpenAI did not return the requested image output.'
            );
        }

        return normalizeOutput({
            output:
                response.output_parsed,

            maxLength,
            includeVisibleText,

            model:
                response.model ||
                IMAGE_MODEL,
        });
    } catch (error) {
        console.error(
            'OpenAI image analysis failed:',
            {
                mode,
                status:
                    error?.status ??
                    null,

                code:
                    error?.code ??
                    null,

                type:
                    error?.type ??
                    null,

                message:
                    error?.message ??
                    'Unknown image analysis error',
            }
        );

        throw createAnalysisError(error);
    }
}

function normalizeOutput({
    output,
    maxLength,
    includeVisibleText,
    model,
}) {
    const normalized = {
        text:
            output.text.trim(),

        model,
    };

    if (
        maxLength &&
        normalized.text.length >
            maxLength
    ) {
        normalized.text =
            shortenText(
                normalized.text,
                maxLength
            );
    }

    if (includeVisibleText) {
        normalized.visibleText =
            [
                ...new Set(
                    output.visibleText
                        .map(
                            (text) =>
                                text.trim()
                        )
                        .filter(Boolean)
                ),
            ];

        normalized.containsText =
            Boolean(
                output.containsText &&
                normalized.visibleText.length >
                    0
            );
    }

    return normalized;
}

function shortenText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }

    const shortened = text
        .slice(
            0,
            Math.max(
                0,
                maxLength - 1
            )
        )
        .replace(
            /\s+\S*$/,
            ''
        )
        .replace(
            /[,\s]+$/,
            ''
        );

    return `${shortened}…`;
}

function createAnalysisError(error) {
    const status =
        Number(error?.status) || 0;

    if (status === 400 || status === 422) {
        return new UnprocessableEntityError(
            'The image could not be analyzed. It may be inaccessible, corrupt, or unsupported.'
        );
    }

    if (status === 429) {
        return createServiceUnavailableError(
            'The selected image-analysis service is temporarily rate-limited. Please wait and try again.'
        );
    }

    if (status === 401 || status === 403) {
        return createServiceUnavailableError(
            'The image-analysis service could not authenticate with OpenAI.'
        );
    }

    if (status >= 500) {
        return createServiceUnavailableError(
            'The image-analysis service is temporarily unavailable.'
        );
    }

    return new UnprocessableEntityError(
        'The image could not be analyzed at this time.'
    );
}

function createServiceUnavailableError(
    message
) {
    const error =
        new AppError(
            message,
            503
        );

    error.name =
        'ServiceUnavailableError';

    error.isOperational =
        true;

    error.retryAfterSeconds =
        30;

    return error;
}

module.exports = {
    analyzeImage,
};
