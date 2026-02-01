import { createLogger, format, transports } from 'winston';
import path from 'path';
import fs from 'fs';

const logDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const transportsList = [];

if (!isTest) {
  transportsList.push(
    // Siempre mostrar en consola
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message, stack }) => {
          if (stack) return `${timestamp} [${level}]: ${message}\n${stack}`;
          return `${timestamp} [${level}]: ${message}`;
        })
      ),
    })
  );
}

export const logger = createLogger({
  level: isProduction ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      if (stack) return `${timestamp} [${level}]: ${message}\n${stack}${metaStr}`;
      return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
  ),
  transports: [
    ...transportsList,
    // Archivo de log general (rotación manual por fecha)
    new transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // Archivo separado para errores
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

// En producción, también loggear a archivo JSON para integración con herramientas de logging
if (isProduction) {
  logger.add(
    new transports.File({
      filename: path.join(logDir, 'combined.json'),
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    })
  );
}
