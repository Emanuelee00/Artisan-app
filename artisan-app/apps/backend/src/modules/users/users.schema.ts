import { z } from 'zod'

export const registerSchema = z
  .object({
    email:      z.string().email('Email non valida'),
    password:   z.string()
                  .min(8, 'Minimo 8 caratteri')
                  .regex(/[A-Z]/, 'Almeno una lettera maiuscola')
                  .regex(/[0-9]/, 'Almeno un numero'),
    name:       z.string().min(2, 'Minimo 2 caratteri').max(100),
    phone:      z.string().min(8).max(20),
    role:       z.enum(['client', 'artisan']),
    // Campi artigiano — richiesti se role === 'artisan'
    category:   z.string().min(2).max(100).optional(),
    bio:        z.string().max(500).optional(),
    hourlyRate: z.number().positive().optional(),
    lat:        z.number().min(-90).max(90).optional(),
    lng:        z.number().min(-180).max(180).optional(),
    radiusKm:   z.number().int().positive().default(20),
  })
  .refine(
    (d) => d.role !== 'artisan' || !!d.category,
    { message: 'category è richiesta per gli artigiani', path: ['category'] }
  )

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export const updateProfileSchema = z.object({
  name:       z.string().min(2).max(100).optional(),
  phone:      z.string().min(8).max(20).optional(),
  avatarUrl:  z.string().url().optional(),
  // Artigiano
  bio:        z.string().max(500).optional(),
  hourlyRate: z.number().positive().optional(),
  lat:        z.number().min(-90).max(90).optional(),
  lng:        z.number().min(-180).max(180).optional(),
  radiusKm:   z.number().int().positive().optional(),
})

export type RegisterDto      = z.infer<typeof registerSchema>
export type LoginDto         = z.infer<typeof loginSchema>
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>
