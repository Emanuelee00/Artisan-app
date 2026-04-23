import { Request, Response, NextFunction } from 'express'
import { logger } from '../shared/logger'

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message })
  }

  logger.error(err.message, { stack: err.stack, path: req.path })
  res.status(500).json({ error: 'Errore interno del server' })
}
