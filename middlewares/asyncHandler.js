// middlewares/asyncHandler.js

/**
 * Wraps an asynchronous Express route handler and forwards rejected
 * promises to the application's global error-handling middleware.
 *
 * @param {Function} handler Express route handler
 * @returns {Function} Wrapped Express route handler
 */
function asyncHandler(handler) {
    if (typeof handler !== 'function') {
        throw new TypeError('asyncHandler requires a function.');
    }

    return function wrappedAsyncHandler(req, res, next) {
        return Promise.resolve(handler(req, res, next)).catch(next);
    };
}

module.exports = asyncHandler;