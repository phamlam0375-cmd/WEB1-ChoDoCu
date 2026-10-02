'use strict';

const AppError = require('../errors/AppError');

function errorHandler(error, _request, response, _next) {
  if (error instanceof AppError) {
    const body = {
      success: false,
      message: error.message,
      error: {
        code: error.code,
        message: error.message
      }
    };

    if (error.details) body.error.details = error.details;
    return response.status(error.status).json(body);
  }

  console.error('Unhandled API error:', error.message);
  return response.status(500).json({
    success: false,
    message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.'
    }
  });
}

module.exports = errorHandler;
