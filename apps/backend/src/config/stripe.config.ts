import Stripe from 'stripe'
import { env, isMock } from './env'
import { StripeMock } from '../mocks/stripe.mock'

export const stripe = isMock('STRIPE_SECRET_KEY')
  ? (new StripeMock() as unknown as Stripe)
  : new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
