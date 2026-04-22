import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV:                    z.enum(['development', 'production', 'test']).default('development'),
  PORT:                        z.coerce.number().default(3000),
  FRONTEND_URL:                z.string().default('http://localhost:8081'),

  DATABASE_URL:                z.string().default('mock'),
  MONGO_URI:                   z.string().default('mock'),
  REDIS_URL:                   z.string().default('mock'),

  JWT_SECRET:                  z.string().default('mock_jwt_secret_dev_only'),
  JWT_EXPIRES_IN:              z.string().default('7d'),

  STRIPE_SECRET_KEY:           z.string().default('mock'),
  STRIPE_WEBHOOK_SECRET:       z.string().default('mock'),
  STRIPE_PLATFORM_FEE_PERCENT: z.coerce.number().default(15),

  FIREBASE_PROJECT_ID:         z.string().default('mock'),
  FIREBASE_PRIVATE_KEY:        z.string().default('mock'),
  FIREBASE_CLIENT_EMAIL:       z.string().default('mock'),

  TWILIO_ACCOUNT_SID:          z.string().default('mock'),
  TWILIO_AUTH_TOKEN:           z.string().default('mock'),
  TWILIO_PHONE_NUMBER:         z.string().default('+15550000000'),

  GOOGLE_MAPS_API_KEY:         z.string().default('mock'),

  S3_BUCKET:                   z.string().default('mock'),
  S3_REGION:                   z.string().default('eu-west-1'),
  AWS_ACCESS_KEY_ID:           z.string().default('mock'),
  AWS_SECRET_ACCESS_KEY:       z.string().default('mock'),
})

export const env = envSchema.parse(process.env)

export type Env = z.infer<typeof envSchema>

export function isMock(key: keyof Env): boolean {
  return (env[key] as string) === 'mock'
}
