import { Request, Response, NextFunction } from "express";

/**
 * Обертка для async функций в Express роутерах
 * Автоматически обрабатывает ошибки и передает их в errorHandler
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): ((req: Request, res: Response, next: NextFunction) => void) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
