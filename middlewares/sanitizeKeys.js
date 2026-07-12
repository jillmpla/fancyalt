// middlewares/sanitizeKeys.js

/**
 * Property names that are unsafe in user input.
 */
const BLOCKED_KEYS = new Set([
    '__proto__',
    'prototype',
    'constructor',
]);

/**
 * Removes unsafe keys from nested objects and arrays.
 *
 * @param {*} value Data to sanitize
 * @param {WeakSet<object>} visited Prevents circular-reference loops
 * @returns {*} The sanitized value
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
        // Remove MongoDB-style operators and unsafe object properties.
        if (key.startsWith('$') || BLOCKED_KEYS.has(key)) {
            delete value[key];
            continue;
        }

        sanitizeKeys(value[key], visited);
    }

    return value;
}

/**
 * Sanitizes request body, query parameters, and route parameters.
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