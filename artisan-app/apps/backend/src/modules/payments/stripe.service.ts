import { stripe } from '../../config/stripe.config'
import { env } from '../../config/env'
import { payoutQueue } from '../../shared/queue/bullmq'

export const StripeService = {
  // Crea account Stripe per l'artigiano (onboarding)
  async createConnectAccount(email: string) {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: { transfers: { requested: true } },
    })
    return account
  },

  // Link di onboarding per completare il profilo Stripe
  async createOnboardingLink(accountId: string, returnUrl: string) {
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    })
    return link.url
  },

  // Cliente paga → piattaforma incassa, poi paga artigiano
  async createPaymentIntent(amount: number, currency: string, jobId: string) {
    const platformFee = Math.round(amount * env.STRIPE_PLATFORM_FEE_PERCENT / 100)

    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: { jobId },
      automatic_payment_methods: { enabled: true },
    })

    return { clientSecret: intent.client_secret, platformFee }
  },

  // Webhook Stripe → payout all'artigiano
  async handleWebhook(payload: Buffer, signature: string) {
    const event = stripe.webhooks.constructEvent(
      payload, signature, env.STRIPE_WEBHOOK_SECRET
    )

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as any
      // Accoda il payout — non blocca la risposta al webhook
      await payoutQueue.add('payout', {
        jobId: intent.metadata.jobId,
        amount: intent.amount,
        currency: intent.currency,
      })
    }

    return event
  },
}
