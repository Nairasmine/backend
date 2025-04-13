const winston = require('winston');
const { combine, timestamp, printf, colorize, errors } = winston.format;

// Define custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
  
  if (stack) {
    log += `\n${stack}`;
  }
  
  if (Object.keys(metadata).length > 0) {
    log += `\n${JSON.stringify(metadata, null, 2)}`;
  }
  
  return log;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }), // Include stack traces for errors
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Console transport (colored output)
    new winston.transports.Console({
      format: combine(
        colorize(),
        logFormat
      )
    }),
    // File transport for errors
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // File transport for all logs
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  // Don't exit on handled exceptions
  exitOnError: false
});

// Add Morgan-like HTTP request logging
logger.stream = {
  write: function(message) {
    logger.info(message.trim());
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Optionally exit the process (recommended for production)
  // process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = logger;