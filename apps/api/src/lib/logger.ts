import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      '*.password',
      '*.di_token',
      '*.email',
      '*.mfa_code',
      '*.refresh_token',
      '*.garmin_token',
      // ValidationError do Elysia carrega o body rejeitado em err.value — sem
      // isto a senha/e-mail/mfa do /garmin/connect vazariam no log de erro.
      '*.value.password',
      '*.value.email',
      '*.value.mfa_code',
      'err.value.password',
      'err.value.email',
      'err.value.mfa_code',
    ],
    censor: '[REDACTED]',
  },
});
