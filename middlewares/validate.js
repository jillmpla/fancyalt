// middlewares/validate.js

const { validationResult } = require('express-validator');
const { BadRequestError } = require('../utils/errors');

/**
 * Collects express-validator errors and forwards a normalized
 * BadRequestError to the global error handler.
 */
function validate(req, res, next) {
    const result = validationResult(req);

    if (result.isEmpty()) {
        return next();
    }

    const details = result.array().map((error) => ({
        field: error.path || error.param || null,
        location: error.location || null,
        message: error.msg,
        value: error.value,
    }));

    return next(
        new BadRequestError(
            'Validation failed.',
            details
        )
    );
}

module.exports = validate;
