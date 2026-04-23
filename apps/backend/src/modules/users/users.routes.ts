import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { UsersController } from './users.controller'
import { authenticate } from '../../gateway/auth.middleware'
import { validate } from '../../gateway/validation.middleware'
import { registerSchema, loginSchema, updateProfileSchema } from './users.schema'

// 5 tentativi per IP ogni 15 minuti — solo per il login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi tentativi di login. Riprova tra 15 minuti.' },
  keyGenerator: (req) => req.ip ?? 'unknown',
  skip: () => process.env.NODE_ENV === 'test',
})

const router = Router()

// Pubbliche
router.post('/register', validate(registerSchema),      UsersController.register)
router.post('/login',    loginLimiter, validate(loginSchema), UsersController.login)
router.post('/refresh',                                  UsersController.refreshToken)

// Protette
router.post('/logout',              authenticate, UsersController.logout)
router.get('/me',                   authenticate, UsersController.getProfile)
router.put('/me',                   authenticate, validate(updateProfileSchema), UsersController.updateProfile)
router.get('/me/artisan-profile',   authenticate, UsersController.getArtisanProfile)

export default router
