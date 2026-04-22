-- Pagamenti
CREATE TABLE IF NOT EXISTS payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                   UUID NOT NULL REFERENCES jobs(id),
  client_id                UUID NOT NULL REFERENCES users(id),
  artisan_id               UUID NOT NULL REFERENCES users(id),
  amount                   INT NOT NULL,          -- centesimi
  platform_fee             INT NOT NULL,
  artisan_payout           INT NOT NULL,
  currency                 VARCHAR(3) DEFAULT 'eur',
  status                   VARCHAR(20) DEFAULT 'pending'
                             CHECK (status IN ('pending','completed','failed','refunded')),
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_job     ON payments(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_artisan ON payments(artisan_id);
