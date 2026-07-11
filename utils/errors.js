// utils/errors.js

class AppError extends Error {
    constructor(
        message = 'Application error',
        statusCode = 500,
        details = null
    ) {
        super(message);

        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * 400 Bad Request
 */
class BadRequestError extends AppError {
    constructor(message = 'Bad Request', details = null) {
        super(message, 400, details);
    }
}

/**
 * 401 Unauthorized
 */
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', details = null) {
        super(message, 401, details);
    }
}

/**
 * 403 Forbidden
 */
class ForbiddenError extends AppError {
    constructor(message = 'Forbidden', details = null) {
        super(message, 403, details);
    }
}

/**
 * 404 Not Found
 */
class NotFoundError extends AppError {
    constructor(message = 'Not Found', details = null) {
        super(message, 404, details);
    }
}

/**
 * 413 Payload Too Large
 */
class PayloadTooLargeError extends AppError {
    constructor(message = 'Payload Too Large', details = null) {
        super(message, 413, details);
    }
}

/**
 * 415 Unsupported Media Type
 */
class UnsupportedMediaTypeError extends AppError {
    constructor(
        message = 'Unsupported Media Type',
        details = null
    ) {
        super(message, 415, details);
    }
}

/**
 * 422 Unprocessable Entity
 */
class UnprocessableEntityError extends AppError {
    constructor(
        message = 'Unprocessable Entity',
        details = null
    ) {
        super(message, 422, details);
    }
}

/**
 * 429 Too Many Requests
 */
class TooManyRequestsError extends AppError {
    constructor(message = 'Too Many Requests', details = null) {
        super(message, 429, details);
    }
}

/**
 * 503 Service Unavailable
 */
class ServiceUnavailableError extends AppError {
    constructor(message = 'Service Unavailable', details = null) {
        super(message, 503, details);
    }
}

module.exports = {
    AppError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    PayloadTooLargeError,
    UnsupportedMediaTypeError,
    UnprocessableEntityError,
    TooManyRequestsError,
    ServiceUnavailableError,
};
