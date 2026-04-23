import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { transaction } from '../../shared/db/postgres'
import { cacheSet, cacheDel, cacheGet } from '../../shared/db/redis'
import { UserModel } from './users.model'
import { AppError } from '../../gateway/errorHandler'
import { env } from '../../config/env'
import type { RegisterDto, LoginDto, UpdateProfileDto } from './users.schema'

const BCRYPT_ROUNDS = 12
const REFRESH_TTL   = 7 * 24 * 60 * 60   // 7 giorni in secondi
const ACCESS_TTL    = '15m'

function refreshKey(userId: string): string {
  return `refresh:${userId}`
}

function signTokens(userId: string, role: string) {
  // jti garantisce unicità anche se firmati nello stesso secondo (token rotation)
  const accessToken  = jwt.sign({ id: userId, role, jti: randomUUID() }, env.JWT_SECRET, { expiresIn: ACCESS_TTL })
  const refreshToken = jwt.sign({ id: userId, role, jti: randomUUID() }, env.JWT_SECRET, { expiresIn: '7d' })
  return { accessToken, refreshToken }
}

function safeUser(user: Awaited<ReturnType<typeof UserModel.findById>>) {
  if (!user) return null
  const { password_hash, fcm_token, ...safe } = user
  return safe
}

export const UsersService = {
  async register(dto: RegisterDto) {
    const existing = await UserModel.findByEmail(dto.email)
    if (existing) throw new AppError(409, 'Email già registrata')

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS)

    let userId!: string
    let artisanProfile = null

    if (dto.role === 'artisan') {
      await transaction(async (q) => {
        const [user] = await q<{ id: string }>(
          `INSERT INTO users (email, password_hash, name, phone, role)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [dto.email, passwordHash, dto.name, dto.phone, dto.role]
        )
        userId = user.id

        const stripeAccountId = `acct_mock_${userId}`
        const [profile] = await q<{ user_id: string; category: string; stripe_account_id: string; rating: number; review_count: number }>(
          `INSERT INTO artisan_profiles
             (user_id, category, bio, hourly_rate, lat, lng, radius_km,
              stripe_account_id, is_verified, rating, review_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, 0, 0)
           RETURNING user_id, category, stripe_account_id, rating, review_count`,
          [userId, dto.category!, dto.bio ?? null, dto.hourlyRate ?? null,
           dto.lat ?? null, dto.lng ?? null, dto.radiusKm ?? 20, stripeAccountId]
        )
        artisanProfile = profile
      })
    } else {
      const user = await UserModel.create({ email: dto.email, passwordHash, name: dto.name, phone: dto.phone, role: dto.role })
      userId = user.id
    }

    const { accessToken, refreshToken } = signTokens(userId, dto.role)
    await cacheSet(refreshKey(userId), refreshToken, REFRESH_TTL)

    const userRow = await UserModel.findById(userId)
    return {
      user: safeUser(userRow),
      accessToken,
      refreshToken,
      ...(artisanProfile ? { artisanProfile } : {}),
    }
  },

  async login(dto: LoginDto) {
    const user = await UserModel.findByEmail(dto.email)
    // Messaggio intenzionalmente generico per non rivelare se l'email esiste
    if (!user) throw new AppError(401, 'Credenziali non valide')

    const valid = await bcrypt.compare(dto.password, user.password_hash)
    if (!valid) throw new AppError(401, 'Credenziali non valide')

    const { accessToken, refreshToken } = signTokens(user.id, user.role)
    await cacheSet(refreshKey(user.id), refreshToken, REFRESH_TTL)

    return { user: safeUser(user), accessToken, refreshToken }
  },

  async refreshToken(token: string) {
    let payload: { id: string; role: string }
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string }
    } catch {
      throw new AppError(401, 'Refresh token non valido o scaduto')
    }

    const stored = await cacheGet(refreshKey(payload.id))
    if (!stored || stored !== token) {
      throw new AppError(401, 'Refresh token non riconosciuto')
    }

    const { accessToken, refreshToken: newRefresh } = signTokens(payload.id, payload.role)
    await cacheSet(refreshKey(payload.id), newRefresh, REFRESH_TTL)

    return { accessToken, refreshToken: newRefresh }
  },

  async logout(userId: string) {
    await cacheDel(refreshKey(userId))
  },

  async getProfile(userId: string) {
    const user = await UserModel.findById(userId)
    if (!user) throw new AppError(404, 'Utente non trovato')
    return safeUser(user)!
  },

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await UserModel.findById(userId)
    if (!user) throw new AppError(404, 'Utente non trovato')

    const updatedUser = await UserModel.update(userId, {
      name:      dto.name,
      phone:     dto.phone,
      avatarUrl: dto.avatarUrl,
    })

    let artisanProfile = null
    if (user.role === 'artisan' && (dto.bio || dto.hourlyRate || dto.lat || dto.lng || dto.radiusKm)) {
      artisanProfile = await UserModel.updateArtisanProfile(userId, {
        bio:        dto.bio,
        hourlyRate: dto.hourlyRate,
        lat:        dto.lat,
        lng:        dto.lng,
        radiusKm:   dto.radiusKm,
      })
    }

    return {
      user: safeUser(updatedUser),
      ...(artisanProfile ? { artisanProfile } : {}),
    }
  },

  async getArtisanProfile(userId: string) {
    const user = await UserModel.findById(userId)
    if (!user) throw new AppError(404, 'Utente non trovato')
    if (user.role !== 'artisan') throw new AppError(404, 'Profilo artigiano non trovato')

    const profile = await UserModel.findArtisanProfile(userId)
    if (!profile) throw new AppError(404, 'Profilo artigiano non trovato')

    return {
      userId:          profile.user_id,
      category:        profile.category,
      bio:             profile.bio,
      hourlyRate:      profile.hourly_rate,
      isVerified:      profile.is_verified,
      rating:          profile.rating,
      reviewCount:     profile.review_count,
      lat:             profile.lat,
      lng:             profile.lng,
      radiusKm:        profile.radius_km,
      stripeAccountId: profile.stripe_account_id,
    }
  },
}
