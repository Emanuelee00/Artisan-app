-- Tabella utenti principale
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          VARCHAR(255) NOT NULL,
  phone         VARCHAR(50),
  role          VARCHAR(20) NOT NULL CHECK (role IN ('client','artisan','admin')),
  avatar_url    TEXT,
  fcm_token     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Profili artigiani (estende users)
CREATE TABLE IF NOT EXISTS artisan_profiles (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  category          VARCHAR(100) NOT NULL,
  bio               TEXT,
  hourly_rate       DECIMAL(10,2),
  is_verified       BOOLEAN DEFAULT FALSE,
  rating            DECIMAL(3,2) DEFAULT 0,
  review_count      INT DEFAULT 0,
  lat               DECIMAL(10,8),
  lng               DECIMAL(11,8),
  radius_km         INT DEFAULT 20,
  stripe_account_id VARCHAR(255),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_artisan_category ON artisan_profiles(category);
