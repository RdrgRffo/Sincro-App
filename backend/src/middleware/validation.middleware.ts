import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

interface ValidationOptions {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}

export function validateRequest(options: ValidationOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (options.body) {
        req.body = await options.body.parseAsync(req.body);
      }

      if (options.query) {
        req.query = await options.query.parseAsync(req.query) as any;
      }

      if (options.params) {
        req.params = await options.params.parseAsync(req.params) as any;
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.issues.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      }

      next(error);
    }
  };
}
