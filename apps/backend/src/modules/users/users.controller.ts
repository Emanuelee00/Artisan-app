import { Request, Response, NextFunction } from 'express'
import { UsersService } from './users.service'
import type { AuthRequest } from '../../gateway/auth.middleware'

const COOKIE_NAME = 'artisan_refresh'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,   // 7 giorni in ms
  path: '/api/v1/users',
}

export const UsersController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await UsersService.register(req.body)
      res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTS)
      res.status(201).json(result)
    } catch (e) { next(e) }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await UsersService.login(req.body)
      res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTS)
      res.json(result)
    } catch (e) { next(e) }
  },

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      // Accetta token dal cookie (web) o dal body (mobile)
      const token: string | undefined = req.cookies?.[COOKIE_NAME] ?? req.body?.refreshToken
      if (!token) {
        res.status(401).json({ error: 'Refresh token mancante' })
        return
      }
      const result = await UsersService.refreshToken(token)
      res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTS)
      res.json(result)
    } catch (e) { next(e) }
  },

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await UsersService.logout(req.user!.id)
      res.clearCookie(COOKIE_NAME, { path: COOKIE_OPTS.path })
      res.json({ message: 'Logout effettuato' })
    } catch (e) { next(e) }
  },

  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const profile = await UsersService.getProfile(req.user!.id)
      res.json(profile)
    } catch (e) { next(e) }
  },

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await UsersService.updateProfile(req.user!.id, req.body)
      res.json(result)
    } catch (e) { next(e) }
  },

  async getArtisanProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const profile = await UsersService.getArtisanProfile(req.user!.id)
      res.json(profile)
    } catch (e) { next(e) }
  },
}
