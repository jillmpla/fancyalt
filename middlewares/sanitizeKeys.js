// middlewares/sanitizeKeys.js

/**
 * Keys that should never be accepted from user-controlled input.
 */
const BLOCKED_KEYS = new Set([
    '__proto__',
    'prototype',
    'constructor',
]);

/**
 * Recursively removes dangerous property names from an object or array.
 *
 * This preserves legitimate nested request data while preventing keys
 * commonly associated with prototype pollution and operator injection.
 *
 * @param {*} value Value to sanitize
 * @param {WeakSet<object>} visited Tracks circular references
 * @returns {*} Sanitized value
 */
function sanitizeKeys(value, visited = new WeakSet()) {
    if (value === null || typeof value !== 'object') {
        return value;
    }

    if (visited.has(value)) {
        return value;
    }

    visited.add(value);

    if (Array.isArray(value)) {
        for (const item of value) {
            sanitizeKeys(item, visited);
        }

        return value;
    }

    for (const key of Object.keys(value)) {
        if (key.startsWith('$') || BLOCKED_KEYS.has(key)) {
            delete value[key];
            continue;
        }

        sanitizeKeys(value[key], visited);
    }

    return value;
}

/**
 * Sanitizes user-controlled Express request locations.
 */
function sanitizeInput(req, res, next) {
    try {
        for (const location of ['body', 'query', 'params']) {
            if (req[location]) {
                sanitizeKeys(req[location]);
            }
        }

        next();
    } catch (error) {
        next(error);
    }
}

module.exports = sanitizeInput;
module.exports.sanitizeKeys = sanitizeKeys;