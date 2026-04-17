import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { AppError, ErrorCode } from "../utils/AppError";

export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const result = schema.parse({
        body: req.body as unknown,
        query: req.query as unknown,
        params: req.params as unknown,
      }) as { body?: unknown; query?: unknown; params?: unknown };
      // Используем провалидированные данные в контроллерах
      if (result.body !== undefined) req.body = result.body;
      if (result.params !== undefined) req.params = result.params as Request["params"];
      if (result.query !== undefined) req.query = result.query as Request["query"];
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        const validationError = new AppError(
          "Validation error",
          400,
          ErrorCode.VALIDATION_ERROR,
          true,
        );
        Object.assign(validationError, { details: errorMessages });
        throw validationError;
      }
      next(error);
    }
  };
};
