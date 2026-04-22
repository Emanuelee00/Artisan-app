# Artisan App — Backend

Marketplace tipo Uber per artigiani. Monorepo Turborepo.

## Stack

| Layer | Tech |
|---|---|
| Mobile | React Native + Expo |
| Backend | Node.js + Express + TypeScript |
| DB relazionale | PostgreSQL (`pg`) |
| DB documenti | MongoDB (`mongoose`) |
| Cache / Geo | Redis (`ioredis`) |
| Pagamenti | Stripe |
| Realtime | Socket.IO |
| Code async | BullMQ |
| Push | Firebase Admin SDK |
| Validazione | Zod |
| Test | Vitest |

---

## Avvio rapido (senza .env)

L'app gira al 100% in **mock mode** senza nessuna variabile d'ambiente.
Ogni servizio esterno ha un mock in-memory trasparente.

```bash
cd apps/backend
npm install --cache /tmp/npm-cache   # prima volta
npm run dev                          # server su :3000 con hot-reload
```

Output atteso:
```
BullMQ queues inizializzate [MOCK]
PostgreSQL [MOCK] connesso
MongoDB [MOCK] connesso (mongodb-memory-server)
Redis [MOCK] connesso
Server running on port 3000 [development]
```

### Popolare il DB con dati fake

```bash
npm run seed
```

Stampa le credenziali di test a fine esecuzione:
```
[admin   ] admin@artisan.dev       password: Admin1234!
[client  ] cliente@artisan.dev     password: Cliente123!
[client  ] mario@artisan.dev       password: Mario1234!
[artisan ] luigi@artisan.dev       password: Luigi1234!
[artisan ] sara@artisan.dev        password: Sara12345!
```

### Eseguire i test

```bash
npm test                                         # tutti i test
npx vitest run src/modules/users/users.test.ts   # solo users
```

### Applicare le migration (DB reale)

```bash
DATABASE_URL=postgresql://... npm run migrate
```

---

## Struttura

```
apps/backend/src/
├── config/
│   ├── env.ts              # Zod schema con .default('mock') su tutto; isMock()
│   ├── stripe.config.ts    # Stripe reale o StripeMock
│   └── firebase.config.ts  # Firebase reale o FirebaseMock
├── mocks/
│   ├── stripe.mock.ts      # paymentIntents, accounts, transfers in Map
│   ├── firebase.mock.ts    # send/multicast con 🔔 console; getLastNotifications()
│   ├── redis.mock.ts       # get/set/setex/del/geo* in memoria
│   ├── postgres.mock.ts    # SQL parser minimale; seed 3 utenti + 2 job
│   └── mongo.mock.ts       # find/insert/update/delete in array
├── shared/
│   └── db/
│       ├── postgres.ts     # Pool reale o mock; query<T>(); transaction()
│       ├── mongo.ts        # mongoose + mongodb-memory-server in mock
│       ├── redis.ts        # ioredis o mock; wrapper typed geo/cache
│       ├── migrate.ts      # runner SQL ordinato con schema_migrations
│       └── seed.ts         # seed completo con bcrypt reale
├── modules/
│   └── users/
│       ├── users.schema.ts     # registerSchema / loginSchema / updateProfileSchema
│       ├── users.model.ts      # query PG tipizzate (UserRow, ArtisanProfileRow)
│       ├── users.service.ts    # business logic pura
│       ├── users.controller.ts # handlers Express + httpOnly cookie
│       ├── users.routes.ts     # router + loginLimiter 5req/15min
│       └── users.test.ts       # 17 test Vitest (zero dipendenze esterne)
└── gateway/
    ├── auth.middleware.ts      # JWT Bearer + authorize(roles)
    ├── errorHandler.ts         # AppError + handler globale
    ├── rateLimiter.ts          # 100 req/15min globale
    ├── validation.middleware.ts # validate(zodSchema)
    └── router.ts               # /api/v1/users|jobs|payments|invoices|notifications
```

---

## API Users (`/api/v1/users`)

| Metodo | Path | Auth | Note |
|---|---|---|---|
| POST | `/register` | — | role=artisan crea anche artisan_profiles |
| POST | `/login` | — | rate limit 5/15min per IP |
| POST | `/refresh` | — | cookie o body.refreshToken |
| POST | `/logout` | ✓ | invalida token da Redis |
| GET | `/me` | ✓ | profilo senza password_hash |
| PUT | `/me` | ✓ | aggiorna nome/telefono/avatar + profilo artigiano |
| GET | `/me/artisan-profile` | ✓ | categoria, rating, stripeAccountId; 404 se client |

### Registrazione artigiano

```json
POST /api/v1/users/register
{
  "email": "mario@example.com",
  "password": "Mario1234!",
  "name": "Mario Bianchi",
  "phone": "+39 347 1234567",
  "role": "artisan",
  "category": "idraulico",
  "bio": "10 anni di esperienza",
  "hourlyRate": 45,
  "lat": 41.9,
  "lng": 12.5
}
```

Risposta `201`:
```json
{
  "user": { "id": "...", "email": "...", "role": "artisan" },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "artisanProfile": {
    "category": "idraulico",
    "stripe_account_id": "acct_mock_<userId>"
  }
}
```

---

## Regola mock

Ogni variabile d'ambiente assente assume il valore `"mock"`.
`isMock('STRIPE_SECRET_KEY')` → `true` → usa `StripeMock`.
L'app parte e risponde senza nessun servizio esterno attivo.

```
DATABASE_URL    → mock  → PostgresMock (array in memoria)
MONGO_URI       → mock  → mongodb-memory-server
REDIS_URL       → mock  → RedisMock (Map in memoria)
STRIPE_SECRET_KEY → mock → StripeMock
FIREBASE_PROJECT_ID → mock → FirebaseMock
```
