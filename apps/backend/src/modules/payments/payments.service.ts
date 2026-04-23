import { stripe } from '../../config/stripe.config'
import { env, isMock } from '../../config/env'
import { query } from '../../shared/db/postgres'
import { logger } from '../../shared/logger'
import { io } from '../../shared/socket'
import { PaymentModel } from './payments.model'
import { JobModel } from '../jobs/jobs.model'
import { AppError } from '../../gateway/errorHandler'
import type { CreateIntentDto, OnboardDto } from './payments.schema'

// ── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_FEE_PERCENT = env.STRIPE_PLATFORM_FEE_PERCENT  // default 15

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcFees(amountCents: number): { platformFee: number; artisanPayout: number } {
  const platformFee   = Math.round(amountCents * PLATFORM_FEE_PERCENT / 100)
  const artisanPayout = amountCents - platformFee
  return { platformFee, artisanPayout }
}

function safeEmit(room: string, event: string, payload: unknown): void {
  io?.to(room)?.emit(event, payload)
}

async function getArtisanStripeAccount(artisanId: string): Promise<string> {
  const rows = await query<{ stripe_account_id: string | null }>(
    'SELECT stripe_account_id FROM artisan_profiles WHERE user_id = $1',
    [artisanId]
  )
  const accountId = rows[0]?.stripe_account_id
  if (!accountId) throw new AppError(400, `Artigiano ${artisanId} non ha un account Stripe attivo`)
  return accountId
}

// ── Service ──────────────────────────────────────────────────────────────────

export const PaymentsService = {
  // ── 1. Onboarding artigiano ───────────────────────────────────────────────

  async onboardArtisan(artisanId: string, dto: OnboardDto) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: dto.email,
      capabilities: { transfers: { requested: true } },
    })

    // Persist immediately — both real and mock
    await query(
      'UPDATE artisan_profiles SET stripe_account_id = $1 WHERE user_id = $2',
      [account.id, artisanId]
    )

    if (isMock('STRIPE_SECRET_KEY')) {
      // Skip onboarding link redirect — mock considers onboarding complete
      return {
        accountId: account.id,
        mockMode:  true,
        message:   'Mock: onboarding completato automaticamente',
      }
    }

    const link = await stripe.accountLinks.create({
      account:     account.id,
      refresh_url: dto.returnUrl ?? `${env.FRONTEND_URL}/onboard`,
      return_url:  dto.returnUrl ?? `${env.FRONTEND_URL}/onboard/complete`,
      type:        'account_onboarding',
    })

    return { accountId: account.id, onboardingUrl: link.url }
  },

  // ── 2. Payment Intent ─────────────────────────────────────────────────────

  async createIntent(clientId: string, dto: CreateIntentDto) {
    const job = await JobModel.findById(dto.jobId)
    if (!job) throw new AppError(404, 'Job non trovato')

    const amountCents = Math.round(Number(job.final_price ?? job.estimated_price ?? 0) * 100)
    if (!amountCents) throw new AppError(400, 'Il job non ha un prezzo definito')

    // Idempotency: return existing pending/completed payment
    const existing = await PaymentModel.findByJobId(dto.jobId)
    if (existing && existing.status !== 'failed') {
      return {
        clientSecret:     existing.stripe_payment_intent_id
          ? `${existing.stripe_payment_intent_id}_secret_mock`
          : null,
        paymentId:        existing.id,
        amount:           existing.amount,
        platformFee:      existing.platform_fee,
        artisanPayout:    existing.artisan_payout,
        currency:         existing.currency,
        stripeIntentId:   existing.stripe_payment_intent_id,
        alreadyExists:    true,
      }
    }

    const { platformFee, artisanPayout } = calcFees(amountCents)

    const currency = dto.currency ?? 'eur'

    const intent = await stripe.paymentIntents.create({
      amount:   amountCents,
      currency,
      metadata: { jobId: dto.jobId, clientId, artisanId: job.artisan_id ?? '' },
      automatic_payment_methods: { enabled: true },
    })

    const payment = await PaymentModel.create({
      jobId:                dto.jobId,
      clientId,
      artisanId:            job.artisan_id ?? '',
      amount:               amountCents,
      platformFee,
      artisanPayout,
      currency,
      stripePaymentIntentId: intent.id,
    })

    logger.info(`Payment intent creato job=${dto.jobId} amount=${amountCents} intent=${intent.id}`)

    return {
      clientSecret:   intent.client_secret,
      paymentId:      payment.id,
      amount:         amountCents,
      platformFee,
      artisanPayout,
      currency,
      stripeIntentId: intent.id,
    }
  },

  // ── 3. Webhook handling ───────────────────────────────────────────────────

  async handleWebhookEvent(type: string, object: Record<string, unknown>) {
    if (type === 'payment_intent.succeeded') {
      const intentId = object.id as string
      const payment  = await PaymentModel.findByIntentId(intentId)

      if (!payment) {
        logger.warn(`Webhook: payment non trovato per intent ${intentId}`)
        return
      }

      await PaymentModel.updateStatus(payment.id, 'completed')
      logger.info(`Payment ${payment.id} → completed (intent ${intentId})`)

      safeEmit(`artisan:${payment.artisan_id}`, 'payment_received', {
        paymentId:    payment.id,
        amount:       payment.amount,
        artisanPayout: payment.artisan_payout,
        jobId:        payment.job_id,
      })
      safeEmit(`client:${payment.client_id}`, 'payment_confirmed', { paymentId: payment.id })
    }

    if (type === 'payment_intent.failed') {
      const intentId = object.id as string
      const payment  = await PaymentModel.findByIntentId(intentId)
      if (payment) {
        await PaymentModel.updateStatus(payment.id, 'failed')
        logger.warn(`Payment ${payment.id} → failed (intent ${intentId})`)
        safeEmit(`client:${payment.client_id}`, 'payment_failed', { paymentId: payment.id })
      }
    }

    if (type === 'transfer.created') {
      logger.info(`Transfer created: ${JSON.stringify(object)}`)
    }
  },

  async processRealWebhook(payload: Buffer, signature: string) {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    )
    await PaymentsService.handleWebhookEvent(
      event.type,
      event.data.object as Record<string, unknown>
    )
    return event.type
  },

  // ── 4. Payout artigiano ───────────────────────────────────────────────────

  async triggerPayout(jobId: string) {
    const payment = await PaymentModel.findByJobId(jobId)
    if (!payment) throw new AppError(404, 'Nessun pagamento trovato per questo job')
    if (payment.status !== 'completed') {
      throw new AppError(409, `Payout non possibile: stato pagamento '${payment.status}'`)
    }

    const stripeAccountId = await getArtisanStripeAccount(payment.artisan_id)

    const transfer = await stripe.transfers.create({
      amount:         payment.artisan_payout,
      currency:       payment.currency,
      destination:    stripeAccountId,
      transfer_group: jobId,
    })

    logger.info(`Payout job=${jobId} amount=${payment.artisan_payout} → ${stripeAccountId} transfer=${transfer.id}`)

    safeEmit(`artisan:${payment.artisan_id}`, 'payout_sent', {
      jobId,
      amount:       payment.artisan_payout,
      currency:     payment.currency,
      transferId:   transfer.id,
    })

    return {
      transferId:    transfer.id,
      amount:        payment.artisan_payout,
      currency:      payment.currency,
      destination:   stripeAccountId,
    }
  },

  // ── 5. Storico pagamenti ──────────────────────────────────────────────────

  async getHistory(userId: string, role: string) {
    if (role === 'admin') return PaymentModel.findAll()
    if (role === 'artisan') return PaymentModel.findByUser(userId, 'artisan')
    return PaymentModel.findByUser(userId, 'client')
  },
}
