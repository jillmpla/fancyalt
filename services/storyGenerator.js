// services/storyGenerator.js

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

const STORY_MODEL =
    process.env.OPENAI_STORY_MODEL ||
    'gpt-5.4-mini';

function createStorySchema(
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

function buildStoryInstructions({
    maxLength,
    includeVisibleText,
}) {
    const lengthInstruction =
        maxLength
            ? `
Keep the story at or below approximately ${maxLength} characters.
`
            : `
Write two or three concise sentences.
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
You are FancyAlt's creative storytelling assistant.

Create one short fictional story directly from the supplied image.
The structured field named text must contain only the story.

Requirements:

- Keep the story visually consistent with the image.
- Do not claim that the fictional events are factual.
- Do not identify unnamed people.
- Do not add graphic, sexual, hateful, or otherwise unsafe details.
- Do not include a heading.
- Do not return alt text, a detailed description, tags,
  accessibility notes, or other unrequested content.

${lengthInstruction}

${visibleTextInstruction}
`.trim();
}

async function generateStory({
    image,
    maxLength = null,
    includeVisibleText = true,
}) {
    const imageUrl =
        getImageUrl(image);

    const storySchema =
        createStorySchema(
            includeVisibleText
        );

    try {
        const response =
            await openai.responses.parse({
                model: STORY_MODEL,
                store: false,

                input: [
                    {
                        role: 'system',

                        content:
                            buildStoryInstructions({
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
                                    'Write only the requested short story for this image.',
                            },
                            {
                                type: 'input_image',
                                image_url: imageUrl,
                                detail: 'low',
                            },
                        ],
                    },
                ],

                text: {
                    format:
                        zodTextFormat(
                            storySchema,
                            'story_image_output'
                        ),
                },
            });

        if (!response.output_parsed) {
            throw new Error(
                'OpenAI did not return the requested story.'
            );
        }

        return normalizeStoryOutput({
            output:
                response.output_parsed,

            maxLength,
            includeVisibleText,

            model:
                response.model ||
                STORY_MODEL,
        });
    } catch (error) {
        console.error(
            'OpenAI story generation failed:',
            {
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
                    'Unknown story error',
            }
        );

        throw createStoryError(error);
    }
}

function normalizeStoryOutput({
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

function createStoryError(error) {
    const status =
        Number(error?.status) || 0;

    if (status === 400 || status === 422) {
        return new UnprocessableEntityError(
            'A story could not be created from this image.'
        );
    }

    if (status === 429) {
        return createServiceUnavailableError(
            'Story generation is temporarily rate-limited. Please wait and try again.'
        );
    }

    if (status === 401 || status === 403) {
        return createServiceUnavailableError(
            'The story service could not authenticate with OpenAI.'
        );
    }

    if (status >= 500) {
        return createServiceUnavailableError(
            'The story service is temporarily unavailable.'
        );
    }

    return new UnprocessableEntityError(
        'The story could not be generated at this time.'
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
    generateStory,
};
