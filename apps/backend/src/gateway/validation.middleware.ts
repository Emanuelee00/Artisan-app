import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

type Source = 'body' | 'query'

export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const data   = source === 'query' ? req.query : req.body
    const result = schema.safeParse(data)
    if (!result.success) {
      return res.status(400).json({
        error: 'Dati non validi',
        details: result.error.flatten().fieldErrors,
      })
    }
    if (source === 'query') {
      // Attach parsed/coerced query to req so downstream can use it typed
      ;(req as Request & { parsedQuery: unknown }).parsedQuery = result.data
    } else {
      req.body = result.data
    }
    next()
  }
}
