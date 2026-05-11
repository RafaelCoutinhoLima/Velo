import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      '*.password',
      '*.di_token',
      '*.email',
      '*.refresh_token',
      '*.garmin_token',
    ],
    censor: '[REDACTED]',
  },
});
