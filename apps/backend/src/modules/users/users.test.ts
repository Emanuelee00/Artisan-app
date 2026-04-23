import { describe, it, expect, beforeEach } from 'vitest'
import { UsersService } from './users.service'
import { resetDb } from '../../shared/db/postgres'
import { resetRedis } from '../../shared/db/redis'

// ── Fixture helpers ───────────────────────────────────────────────────────────

const clientDto = {
  email:    'test.client@artisan.dev',
  password: 'Test1234!',
  name:     'Test Client',
  phone:    '+39 333 0000001',
  role:     'client' as const,
  radiusKm: 20,
}

const artisanDto = {
  email:      'test.artisan@artisan.dev',
  password:   'Test1234!',
  name:       'Test Artisan',
  phone:      '+39 347 0000002',
  role:       'artisan' as const,
  category:   'idraulico',
  bio:        'Idraulico di test.',
  hourlyRate: 40,
  lat:        41.9,
  lng:        12.5,
  radiusKm:   20,
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetDb()
  resetRedis()
})

// ── Register ──────────────────────────────────────────────────────────────────

describe('UsersService.register', () => {
  it('registra un cliente e ritorna accessToken + refreshToken', async () => {
    const result = await UsersService.register(clientDto)

    expect(result.user).toMatchObject({
      email: clientDto.email,
      role: 'client',
    })
    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    expect(result.artisanProfile).toBeUndefined()
  })

  it('registra un artigiano e crea il profilo artigiano', async () => {
    const result = await UsersService.register(artisanDto)

    expect(result.user).toMatchObject({ role: 'artisan' })
    expect(result.artisanProfile).toBeDefined()
    expect(result.artisanProfile).toMatchObject({
      category: 'idraulico',
    })
  })

  it("l'artigiano riceve uno stripeAccountId mock", async () => {
    const result = await UsersService.register(artisanDto)
    const userId = (result.user as { id: string }).id
    const profile = result.artisanProfile as { stripe_account_id: string } | undefined
    expect(profile?.stripe_account_id).toBe(`acct_mock_${userId}`)
  })

  it('lancia 409 se email già registrata', async () => {
    await UsersService.register(clientDto)
    await expect(UsersService.register(clientDto)).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('lancia 409 per artigiano con stessa email', async () => {
    await UsersService.register(artisanDto)
    await expect(UsersService.register(artisanDto)).rejects.toMatchObject({
      statusCode: 409,
    })
  })
})

// ── Login ─────────────────────────────────────────────────────────────────────

describe('UsersService.login', () => {
  beforeEach(async () => {
    await UsersService.register(clientDto)
  })

  it('login con credenziali corrette ritorna token e user', async () => {
    const result = await UsersService.login({
      email:    clientDto.email,
      password: clientDto.password,
    })

    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    expect(result.user).toMatchObject({ email: clientDto.email })
    expect((result.user as Record<string, unknown>)['password_hash']).toBeUndefined()
  })

  it('lancia 401 con password errata', async () => {
    await expect(
      UsersService.login({ email: clientDto.email, password: 'Wrong999!' })
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('lancia 401 con email inesistente', async () => {
    await expect(
      UsersService.login({ email: 'ghost@artisan.dev', password: 'Test1234!' })
    ).rejects.toMatchObject({ statusCode: 401 })
  })
})

// ── RefreshToken ──────────────────────────────────────────────────────────────

describe('UsersService.refreshToken', () => {
  it('emette un nuovo accessToken con un refresh token valido', async () => {
    const { refreshToken } = await UsersService.register(clientDto)
    const result = await UsersService.refreshToken(refreshToken)

    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    // Il refresh token viene ruotato
    expect(result.refreshToken).not.toBe(refreshToken)
  })

  it('lancia 401 con token falso', async () => {
    await expect(UsersService.refreshToken('fake.token.here')).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('lancia 401 dopo logout (token rimosso da Redis)', async () => {
    const { refreshToken, user } = await UsersService.register(clientDto)
    await UsersService.logout((user as { id: string }).id)
    await expect(UsersService.refreshToken(refreshToken)).rejects.toMatchObject({
      statusCode: 401,
    })
  })
})

// ── GetProfile ────────────────────────────────────────────────────────────────

describe('UsersService.getProfile', () => {
  it('ritorna il profilo senza password_hash', async () => {
    const { user } = await UsersService.register(clientDto)
    const profile = await UsersService.getProfile((user as { id: string }).id)

    expect(profile.email).toBe(clientDto.email)
    expect((profile as Record<string, unknown>)['password_hash']).toBeUndefined()
  })

  it('lancia 404 per userId inesistente', async () => {
    await expect(UsersService.getProfile('ghost_id')).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

// ── UpdateProfile ─────────────────────────────────────────────────────────────

describe('UsersService.updateProfile', () => {
  it('aggiorna nome e telefono del cliente', async () => {
    const { user } = await UsersService.register(clientDto)
    const userId = (user as { id: string }).id

    const result = await UsersService.updateProfile(userId, {
      name:  'Nome Aggiornato',
      phone: '+39 333 9999999',
    })

    expect(result.user?.name).toBe('Nome Aggiornato')
  })

  it('aggiorna il profilo artigiano se role=artisan', async () => {
    const { user } = await UsersService.register(artisanDto)
    const userId = (user as { id: string }).id

    const result = await UsersService.updateProfile(userId, {
      bio:        'Nuova bio aggiornata',
      hourlyRate: 55,
    })

    expect(result.artisanProfile).toBeDefined()
  })
})

// ── GetArtisanProfile ─────────────────────────────────────────────────────────

describe('UsersService.getArtisanProfile', () => {
  it('ritorna il profilo artigiano con tutti i campi', async () => {
    const { user } = await UsersService.register(artisanDto)
    const userId = (user as { id: string }).id

    const profile = await UsersService.getArtisanProfile(userId)

    expect(profile.category).toBe('idraulico')
    expect(profile.stripeAccountId).toBe(`acct_mock_${userId}`)
    expect(profile.rating).toBeDefined()
    expect(profile.reviewCount).toBeDefined()
  })

  it('lancia 404 se il client richiede il profilo artigiano', async () => {
    const { user } = await UsersService.register(clientDto)
    const userId = (user as { id: string }).id

    await expect(UsersService.getArtisanProfile(userId)).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})
