import { describe, it, expect, beforeEach } from 'vitest'
import { PaymentsService } from './payments.service'
import { PaymentModel } from './payments.model'
import { JobsService } from '../jobs/jobs.service'
import { UsersService } from '../users/users.service'
import { resetDb } from '../../shared/db/postgres'
import { resetRedis } from '../../shared/db/redis'
import { StripeMock } from '../../mocks/stripe.mock'
import { stripe } from '../../config/stripe.config'

// ── Seed IDs (from postgres.mock.ts seed) ────────────────────────────────────

const CLIENT_ID  = 'usr_client_001'
const ARTISAN_ID = 'usr_artisan_001'
const JOB_ID     = 'job_001'  // final_price = 85, status = completed

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetDb()
  resetRedis()
  ;(stripe as unknown as StripeMock).reset?.()
})

// ── Onboarding ────────────────────────────────────────────────────────────────

describe('PaymentsService.onboardArtisan', () => {
  it('mock: crea account e salva stripe_account_id nel DB', async () => {
    const result = await PaymentsService.onboardArtisan(ARTISAN_ID, {
      email: 'artigiano@artisan.dev',
    })

    expect(result.accountId).toMatch(/acct/)
    expect(result.mockMode).toBe(true)
    expect(result.message).toContain('Mock')
  })

  it('in mock mode non ritorna onboardingUrl', async () => {
    const result = await PaymentsService.onboardArtisan(ARTISAN_ID, {
      email: 'artigiano@artisan.dev',
    })
    expect((result as Record<string, unknown>).onboardingUrl).toBeUndefined()
  })

  it('crea anche un nuovo artigiano registrato on-the-fly', async () => {
    const { user } = await UsersService.register({
      email:      'nuovo.art@artisan.dev',
      password:   'Test1234!',
      name:       'Nuovo Artigiano',
      phone:      '+39 347 1111111',
      role:       'artisan',
      category:   'elettricista',
      hourlyRate: 35,
      lat:        41.9,
      lng:        12.5,
      radiusKm:   20,
    })

    const result = await PaymentsService.onboardArtisan(
      (user as { id: string }).id,
      { email: 'nuovo.art@artisan.dev' }
    )

    expect(result.accountId).toMatch(/acct/)
    expect(result.mockMode).toBe(true)
  })
})

// ── Payment Intent ─────────────────────────────────────────────────────────────

describe('PaymentsService.createIntent', () => {
  it('crea payment intent per job con final_price e salva nel DB', async () => {
    const result = await PaymentsService.createIntent(CLIENT_ID, { jobId: JOB_ID })

    expect(result.clientSecret).toBeTruthy()
    expect(result.amount).toBe(8500)              // 85.00 € → centesimi
    expect(result.platformFee).toBe(1275)          // 15% di 8500
    expect(result.artisanPayout).toBe(7225)        // 85% di 8500
    expect(result.stripeIntentId).toMatch(/pi_mock/)
    expect(result.paymentId).toBeTruthy()
  })

  it('salva correttamente nel DB', async () => {
    await PaymentsService.createIntent(CLIENT_ID, { jobId: JOB_ID })
    const saved = await PaymentModel.findByJobId(JOB_ID)

    expect(saved).not.toBeNull()
    expect(saved!.status).toBe('pending')
    expect(saved!.amount).toBe(8500)
    expect(saved!.platform_fee).toBe(1275)
    expect(saved!.artisan_payout).toBe(7225)
    expect(saved!.client_id).toBe(CLIENT_ID)
    expect(saved!.artisan_id).toBe(ARTISAN_ID)
  })

  it('è idempotente: ritorna payment esistente se già pending', async () => {
    const first  = await PaymentsService.createIntent(CLIENT_ID, { jobId: JOB_ID })
    const second = await PaymentsService.createIntent(CLIENT_ID, { jobId: JOB_ID })

    expect(second.paymentId).toBe(first.paymentId)
    expect(second.alreadyExists).toBe(true)
  })

  it('lancia 404 per job inesistente', async () => {
    await expect(
      PaymentsService.createIntent(CLIENT_ID, { jobId: 'ghost_job' })
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('lancia 400 se il job non ha prezzo', async () => {
    // Crea un job senza estimated_price
    const job = await JobsService.createJob(CLIENT_ID, {
      title: 'Senza prezzo',
      description: 'Nessun prezzo definito per questo job.',
      category: 'idraulico',
      address: 'Via Test 1, Roma',
      lat: 41.9,
      lng: 12.5,
    })
    await expect(
      PaymentsService.createIntent(CLIENT_ID, { jobId: job.id })
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})

// ── Webhook: payment_intent.succeeded ────────────────────────────────────────

describe('PaymentsService.handleWebhookEvent — succeeded', () => {
  it('aggiorna status a completed', async () => {
    const intent = await PaymentsService.createIntent(CLIENT_ID, { jobId: JOB_ID })

    await PaymentsService.handleWebhookEvent('payment_intent.succeeded', {
      id:       intent.stripeIntentId!,
      amount:   intent.amount,
      currency: 'eur',
      metadata: { jobId: JOB_ID },
    })

    const updated = await PaymentModel.findByJobId(JOB_ID)
    expect(updated!.status).toBe('completed')
  })

  it('non lancia errore se il payment non esiste (idempotent)', async () => {
    await expect(
      PaymentsService.handleWebhookEvent('payment_intent.succeeded', {
        id: 'pi_mock_nonexistent',
      })
    ).resolves.toBeUndefined()
  })
})

// ── Webhook: payment_intent.failed ────────────────────────────────────────────

describe('PaymentsService.handleWebhookEvent — failed', () => {
  it('aggiorna status a failed', async () => {
    const intent = await PaymentsService.createIntent(CLIENT_ID, { jobId: JOB_ID })

    await PaymentsService.handleWebhookEvent('payment_intent.failed', {
      id: intent.stripeIntentId!,
    })

    const updated = await PaymentModel.findByJobId(JOB_ID)
    expect(updated!.status).toBe('failed')
  })
})

// ── Payout ────────────────────────────────────────────────────────────────────

describe('PaymentsService.triggerPayout', () => {
  async function setupCompletedPayment() {
    const intent = await PaymentsService.createIntent(CLIENT_ID, { jobId: JOB_ID })
    await PaymentsService.handleWebhookEvent('payment_intent.succeeded', {
      id: intent.stripeIntentId!,
    })
    return intent
  }

  it('trasferisce i fondi e ritorna transferId', async () => {
    await setupCompletedPayment()
    const result = await PaymentsService.triggerPayout(JOB_ID)

    expect(result.transferId).toMatch(/tr_mock/)
    expect(result.amount).toBe(7225)
    expect(result.currency).toBe('eur')
    expect(result.destination).toMatch(/acct_mock/)
  })

  it('il trasferimento è registrato nel StripeMock', async () => {
    await setupCompletedPayment()
    await PaymentsService.triggerPayout(JOB_ID)

    const transfers = (stripe as unknown as StripeMock).getTransfers()
    expect(transfers.length).toBe(1)
    expect(transfers[0].amount).toBe(7225)
  })

  it('lancia 409 se il pagamento è ancora pending', async () => {
    await PaymentsService.createIntent(CLIENT_ID, { jobId: JOB_ID })
    await expect(
      PaymentsService.triggerPayout(JOB_ID)
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('lancia 404 se non esiste nessun pagamento per il job', async () => {
    await expect(
      PaymentsService.triggerPayout('job_002')    // job senza payment
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ── Full E2E Flow ─────────────────────────────────────────────────────────────

describe('Full payment flow: intent → webhook → payout', () => {
  it('completa il ciclo completo senza errori', async () => {
    // Step 1: client crea payment intent
    const intent = await PaymentsService.createIntent(CLIENT_ID, { jobId: JOB_ID })
    expect(intent.clientSecret).toBeTruthy()

    // Step 2: Stripe notifica il successo
    await PaymentsService.handleWebhookEvent('payment_intent.succeeded', {
      id: intent.stripeIntentId!,
    })
    const afterWebhook = await PaymentModel.findByJobId(JOB_ID)
    expect(afterWebhook!.status).toBe('completed')

    // Step 3: payout artigiano
    const payout = await PaymentsService.triggerPayout(JOB_ID)
    expect(payout.amount).toBe(7225)

    // Step 4: verifica storico client
    const history = await PaymentsService.getHistory(CLIENT_ID, 'client')
    expect(history.length).toBeGreaterThan(0)
    expect(history[0].status).toBe('completed')
  })
})

// ── Storico pagamenti ─────────────────────────────────────────────────────────

describe('PaymentsService.getHistory', () => {
  it('client vede i propri pagamenti', async () => {
    await PaymentsService.createIntent(CLIENT_ID, { jobId: JOB_ID })
    const history = await PaymentsService.getHistory(CLIENT_ID, 'client')
    expect(history.every((p) => p.client_id === CLIENT_ID)).toBe(true)
  })

  it('artigiano vede i propri pagamenti', async () => {
    await PaymentsService.createIntent(CLIENT_ID, { jobId: JOB_ID })
    const history = await PaymentsService.getHistory(ARTISAN_ID, 'artisan')
    expect(history.every((p) => p.artisan_id === ARTISAN_ID)).toBe(true)
  })

  it('admin vede tutti i pagamenti', async () => {
    await PaymentsService.createIntent(CLIENT_ID, { jobId: JOB_ID })
    const history = await PaymentsService.getHistory('usr_admin_001', 'admin')
    expect(history.length).toBeGreaterThan(0)
  })

  it('ritorna lista vuota se non ci sono pagamenti', async () => {
    // DB resettato, nessun pagamento creato
    const history = await PaymentsService.getHistory(CLIENT_ID, 'client')
    expect(history).toHaveLength(0)
  })
})
