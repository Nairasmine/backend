/**
 * A utility function to wrap asynchronous route handlers
 * and automatically pass errors to Express error handlers.
 * @param {Function} fn - The async function to wrap.
 * @returns {Function} - A wrapped function with error handling.
 */
const wrapAsync = (fn) => {
    return (req, res, next) => {
      fn(req, res, next).catch(next);
    };
  };
  
  module.exports = wrapAsync;
  