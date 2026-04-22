-- Lavori / richieste
CREATE TABLE IF NOT EXISTS jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES users(id),
  artisan_id      UUID REFERENCES users(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(100) NOT NULL,
  address         TEXT NOT NULL,
  lat             DECIMAL(10,8),
  lng             DECIMAL(11,8),
  status          VARCHAR(30) DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','in_progress','completed','cancelled')),
  scheduled_at    TIMESTAMPTZ,
  estimated_price DECIMAL(10,2),
  final_price     DECIMAL(10,2),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_client   ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_artisan  ON jobs(artisan_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status   ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
