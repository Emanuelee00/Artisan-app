# Artisan App

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
npm install
npm run dev          # server su :3000 con hot-reload
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
npm test                                                    # tutti (141 test)
npx vitest run src/modules/users/users.test.ts              # solo users (17)
npx vitest run src/modules/jobs/jobs.test.ts                # solo jobs (28)
npx vitest run src/modules/payments/payments.test.ts        # solo payments (20)
npx vitest run src/modules/chat/chat.test.ts                # solo chat (20)
npx vitest run src/modules/tracking/tracking.test.ts        # solo tracking (25)
npx vitest run src/modules/invoices/invoices.test.ts        # solo invoices (31)
```

### Applicare le migration (DB reale)

```bash
DATABASE_URL=postgresql://... npm run migrate
```

---

## Struttura

```
artisan-app/
├── packages/
│   └── shared-types/src/index.ts   # User, Job, Payment, Chat, Invoice, Notification
└── apps/backend/src/
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
    │   ├── db/
    │   │   ├── postgres.ts     # Pool reale o mock; query<T>(); transaction()
    │   │   ├── mongo.ts        # mongoose + mongodb-memory-server in mock
    │   │   ├── redis.ts        # ioredis o mock; wrapper typed geo/cache
    │   │   ├── migrate.ts      # runner SQL ordinato con schema_migrations
    │   │   ├── seed.ts         # seed completo con bcrypt reale
    │   │   └── migrations/     # 001_users.sql 002_jobs.sql 003_payments.sql
    │   ├── queue/
    │   │   ├── bullmq.ts       # Queue/Worker BullMQ reale o mock (Redis-free)
    │   │   └── jobs/           # generateInvoice · sendNotification · stripePayout
    │   ├── logger.ts           # Winston
    │   └── socket.ts           # Socket.IO init; io singleton
    ├── modules/
    │   ├── users/
    │   │   ├── users.schema.ts     # registerSchema / loginSchema / updateProfileSchema
    │   │   ├── users.model.ts      # query PG tipizzate (UserRow, ArtisanProfileRow)
    │   │   ├── users.service.ts    # business logic pura
    │   │   ├── users.controller.ts # handlers Express + httpOnly cookie
    │   │   ├── users.routes.ts     # router + loginLimiter 5req/15min
    │   │   └── users.test.ts       # 17 test Vitest (17/17)
    │   ├── jobs/
    │   │   ├── jobs.schema.ts      # createJob / listJobs / completeJob / cancelJob
    │   │   ├── jobs.model.ts       # JobRow; findAll con filtri dinamici
    │   │   ├── jobs.matching.ts    # scoring: dist×0.4 + rating×0.4 + respTime×0.2
    │   │   ├── jobs.service.ts     # CRUD + WebSocket events + trigger pagamento
    │   │   ├── jobs.controller.ts  # handlers Express
    │   │   ├── jobs.routes.ts      # router con authorize(role)
    │   │   └── jobs.test.ts        # 28 test Vitest (28/28)
    │   ├── payments/
    │   │   ├── stripe.service.ts   # createPaymentIntent / webhook / payout
    │   │   ├── payments.controller.ts
    │   │   └── payments.routes.ts
    │   ├── chat/
    │   │   ├── chat.model.ts       # Chat + Message mongoose schemas (unread, readAt)
    │   │   ├── chat.service.ts     # getOrCreate, sendMessage, getHistory, markRead, getUnread
    │   │   ├── chat.gateway.ts     # Socket.IO: join_chat, send_message, mark_read, typing
    │   │   ├── chat.controller.ts  # REST handlers
    │   │   ├── chat.routes.ts      # GET /unread · GET /:jobId/messages
    │   │   ├── chat.events.ts      # event constants
    │   │   └── chat.test.ts        # 20 test Vitest (service + REST + WebSocket)
    │   ├── notifications/
    │   │   ├── firebase.service.ts # send / multicast via FCM (o mock)
    │   │   ├── notifications.service.ts
    │   │   ├── notifications.routes.ts
    │   │   └── notifications.events.ts
    │   ├── invoices/
    │   │   ├── invoices.schema.ts     # Zod: createInvoiceSchema
    │   │   ├── invoices.model.ts      # InvoiceDoc mongoose schema (items, taxRate, pdfPath)
    │   │   ├── pdf.generator.ts       # PDFKit: header branded, tabella voci, IVA 22%, footer
    │   │   ├── invoices.service.ts    # createFromJob, createDraft, generatePdf, send, findAll
    │   │   ├── invoices.controller.ts # REST handlers
    │   │   ├── invoices.routes.ts     # POST / · GET / · GET /:id · GET /:id/pdf · POST /:id/send
    │   │   └── invoices.test.ts       # 31 test Vitest (service + REST + PDF bytes)
    │   └── tracking/
    │       ├── geo.utils.ts           # haversineKm, estimateEtaMinutes, isWithinRadius
    │       ├── tracking.service.ts    # updatePosition, getRoute, getLastPosition, geodist
    │       ├── tracking.gateway.ts    # WS: update_location → artisan_location + geofencing
    │       ├── tracking.controller.ts # REST handlers
    │       ├── tracking.routes.ts     # GET /:jobId/route · GET /:jobId/position
    │       └── tracking.test.ts       # 25 test Vitest (geo utils + service + REST + WS)
    └── gateway/
        ├── auth.middleware.ts      # JWT Bearer + authorize(roles)
        ├── errorHandler.ts         # AppError + handler globale
        ├── rateLimiter.ts          # 100 req/15min globale
        ├── validation.middleware.ts # validate(zodSchema, source)
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

## API Jobs (`/api/v1/jobs`)

| Metodo | Path | Auth | Ruolo | Note |
|---|---|---|---|---|
| POST | `/` | ✓ | client | Crea richiesta; emette `new_job` via WS agli artigiani vicini |
| GET | `/` | ✓ | tutti | Lista con filtri: `?status=pending&category=idraulico&mine=true` |
| GET | `/:id` | ✓ | tutti | Dettaglio job |
| GET | `/:id/matches` | ✓ | tutti | Top-5 artigiani scored (solo job pending) |
| PATCH | `/:id/accept` | ✓ | artisan | Accetta → status `accepted`; emette `job_accepted` |
| PATCH | `/:id/start` | ✓ | artisan | Avvia → status `in_progress`; emette `job_started` |
| PATCH | `/:id/complete` | ✓ | artisan | Completa con `finalPrice` → trigger Stripe PaymentIntent |
| PATCH | `/:id/cancel` | ✓ | client/artisan | Cancella (solo da `pending/accepted/in_progress`) |

### Creazione job

```json
POST /api/v1/jobs
Authorization: Bearer <access_token>
{
  "title": "Riparazione perdita sotto lavandino",
  "description": "Perdita dal sifone, urgente.",
  "category": "idraulico",
  "address": "Via Roma 10, Roma",
  "lat": 41.9028,
  "lng": 12.4964,
  "scheduledAt": "2026-05-01T10:00:00Z",
  "estimatedPrice": 80
}
```

### Algoritmo di matching (`GET /jobs/:id/matches`)

Ritorna i top-5 artigiani con `category` compatibile nel raggio di 20 km.

```
score = (1 / (1 + distKm)) × 0.4
      + (rating / 5)       × 0.4
      + (1 / (1 + respMin))× 0.2
```

Risposta:
```json
[
  {
    "artisanId": "usr_artisan_001",
    "name": "Luigi Bianchi",
    "category": "idraulico",
    "rating": 4.8,
    "reviewCount": 34,
    "isVerified": true,
    "distanceKm": 0.3,
    "estimatedArrivalMin": 1,
    "score": 0.784
  }
]
```

### WebSocket events (Socket.IO)

| Event | Room | Emesso quando |
|---|---|---|
| `new_job` | `artisan:<id>` | Job creato — agli artigiani vicini |
| `job_accepted` | `job:<id>`, `client:<id>` | Artigiano accetta |
| `job_started` | `job:<id>` | Artigiano avvia |
| `job_completed` | `job:<id>`, `client:<id>` | Artigiano completa |
| `payment_required` | `client:<id>` | Dopo completamento — include `clientSecret` Stripe |
| `job_cancelled` | `job:<id>`, `client:<id>`, `artisan:<id>` | Qualsiasi parte cancella |

---

## API Chat (`/api/v1/chat`)

| Metodo | Path | Auth | Note |
|---|---|---|---|
| GET | `/unread` | ✓ | Messaggi non letti per utente autenticato |
| GET | `/:jobId/messages` | ✓ | Storico paginato: `?page=1&limit=50` |

### WebSocket events (Socket.IO)

Il client si autentica passando il JWT in `socket.handshake.auth.token`.

**Client → Server:**

| Event | Payload | Note |
|---|---|---|
| `join_chat` | `{ jobId, clientId?, artisanId? }` | Crea/recupera chat, entra nella stanza |
| `send_message` | `{ jobId, text?, imageUrl?, type? }` | Invia messaggio (text/image/system) |
| `mark_read` | `{ chatId }` | Azzera unread counter, imposta readAt |
| `typing` | `{ chatId }` | Propaga indicatore di scrittura |

**Server → Client:**

| Event | Payload | Emesso quando |
|---|---|---|
| `chat_joined` | `{ chatId, jobId, clientId, artisanId }` | Conferma join |
| `new_message` | `{ message }` | Nuovo messaggio nella stanza |
| `messages_read` | `{ chatId, userId }` | Un utente ha letto i messaggi |
| `user_typing` | `{ userId, chatId }` | Utente sta scrivendo |

### Esempio flusso

```javascript
// 1. Connessione con JWT
const socket = io('http://localhost:3000', { auth: { token: accessToken } })

// 2. Entra nella chat del job
socket.emit('join_chat', { jobId: 'job_001', clientId: 'usr_client_001', artisanId: 'usr_artisan_001' })
socket.on('chat_joined', ({ chatId }) => console.log('Chat:', chatId))

// 3. Invia messaggio
socket.emit('send_message', { jobId: 'job_001', text: 'Ciao, quando arrivi?' })
socket.on('new_message', ({ message }) => console.log(message.text))

// 4. Segna letti
socket.emit('mark_read', { chatId })
```

---

## API Tracking GPS (`/api/v1/tracking`)

| Metodo | Path | Auth | Note |
|---|---|---|---|
| GET | `/:jobId/route` | ✓ | Intero percorso registrato (array di TrackPoint) |
| GET | `/:jobId/position` | ✓ | Ultima posizione artigiano (solo partecipanti) |

### WebSocket events

**Client → Server:**

| Event | Payload | Note |
|---|---|---|
| `update_location` | `{ jobId, lat, lng, accuracy? }` | Artigiano invia posizione ogni ~5s |

**Server → Client:**

| Event | Room | Emesso quando |
|---|---|---|
| `artisan_location` | `job:<id>` | Nuova posizione — include `eta` (min) e `distanceM` |
| `artisan_nearby`   | `client:<id>` | Artigiano entro 500m dalla destinazione |

### Redis storage

```
artisans:geo         → GEOADD  lat/lng per ogni artigiano online
artisan:online:<id>  → SETEX   TTL 300s (mark online)
job:track:<jobId>    → LPUSH   array di TrackPoint JSON (max 500 punti, LTRIM)
```

### Algoritmo ETA

```
distKm = haversineKm(artisanLat, artisanLng, jobLat, jobLng)
eta    = ceil(distKm / avgSpeedKmh * 60)   # default 30 km/h
```

### Esempio flusso

```javascript
// Artigiano trasmette posizione ogni 5 secondi
setInterval(() => {
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    socket.emit('update_location', {
      jobId: 'job_001',
      lat:   coords.latitude,
      lng:   coords.longitude,
      accuracy: coords.accuracy,
    })
  })
}, 5000)

// Cliente riceve posizione in tempo reale
socket.on('artisan_location', ({ lat, lng, eta, distanceM }) => {
  updateMap(lat, lng)
  showEta(eta)
})

// Notifica avvicinamento
socket.on('artisan_nearby', ({ distanceM, eta }) => {
  alert(`L'artigiano è a ${distanceM}m — ETA ${eta} min`)
})
```

---

## API Invoices (`/api/v1/invoices`)

| Metodo | Path | Auth | Ruolo | Note |
|---|---|---|---|---|
| POST | `/` | ✓ | artisan | Crea bozza manuale con voci personalizzate |
| GET | `/` | ✓ | tutti | Lista fatture (artigiano→sue, cliente→sue, admin→tutte) |
| GET | `/:id` | ✓ | tutti | Dettaglio (solo partecipanti o admin) |
| GET | `/:id/pdf` | ✓ | tutti | Download PDF (genera al volo se non ancora fatto) |
| POST | `/:id/send` | ✓ | artisan | Invia: genera PDF → chat + email mock → status `sent` |

### Flusso automatico

Quando `PATCH /jobs/:id/complete` viene chiamato, in background viene:
1. Creata la fattura con `InvoicesService.createFromJob(jobId)`
2. Accodato `invoiceQueue.add('generateInvoice', { invoiceId })` (BullMQ)
3. Il worker genera il PDF e lo salva in `/tmp/invoices/` (mock) o S3 (prod)

### PDF layout (PDFKit)

```
┌─────────────────────────────────────────────────────────────┐
│  Artisan App [blu]                         FATTURA N. XXX   │
│  Marketplace per artigiani                 2026-01-15       │
├─────────────────────────────────────────────────────────────┤
│  FORNITORE                    CLIENTE                       │
│  Luigi Bianchi                Mario Rossi                   │
│  artigiano@artisan.dev        cliente@artisan.dev           │
├─────────────────────────────────────────────────────────────┤
│  DESCRIZIONE           QTÀ    PREZZO UNIT.    TOTALE        │
│  Riparazione perdita    1      €85.00         €85.00        │
├─────────────────────────────────────────────────────────────┤
│                               Subtotale:      €85.00        │
│                               IVA (22%):      €18.70        │
│                               TOTALE:         €103.70       │
├─────────────────────────────────────────────────────────────┤
│              Generato da Artisan App — artisan.dev          │
└─────────────────────────────────────────────────────────────┘
```

### Mock mode

| Comportamento | Mock | Prod |
|---|---|---|
| PDF storage | `/tmp/invoices/<id>.pdf` | S3 Bucket |
| BullMQ worker | log `[BullMQ MOCK]` (sincrono) | Worker Redis reale |
| Email | `[EMAIL MOCK]` in console | SMTP reale |

---

## Mobile (React Native + Expo)

### Avvio

```bash
cd apps/mobile
npm install
npx expo start
```

### Schermate

| Screen | Path | Descrizione |
|---|---|---|
| Login | `(auth)/login` | Email + password, validazione Zod, salva tokens in Zustand + SecureStore |
| Registrazione | `(auth)/register` | Role selector (cliente/artigiano), step 2 per artigiani (categoria, tariffa) |
| Home | `(app)/home` | Lista lavori recenti (cliente) o lavori disponibili (artigiano), FAB crea lavoro |
| Lavori | `(app)/jobs` | Lista con filtri per status, tasto "Nuovo" |
| Nuovo lavoro | `(app)/jobs/new` | Modal: titolo, categoria, descrizione, indirizzo, prezzo stimato |
| Dettaglio lavoro | `(app)/jobs/[id]` | Timeline status, azioni contestuali, link alla chat |
| Chat | `(app)/chat/[jobId]` | Messaggi in tempo reale via Socket.IO, bolle distinte per mittente |
| Pagamenti | `(app)/payments` | Lista transazioni, badge guadagni (artigiano), onboarding Stripe |
| Profilo | `(app)/profile` | Info utente, profilo artigiano, logout |

### Store e servizi

```
apps/mobile/
├── store/
│   └── auth.store.ts          # Zustand: user, tokens, login(), logout(), initialize()
└── services/
    ├── api.ts                 # Axios con JWT interceptor + auto-logout 401
    ├── auth.ts                # UsersAPI: login, register, me, artisanProfile
    ├── jobs.ts                # JobsAPI: list, get, create, accept, start, complete, cancel
    ├── payments.ts            # PaymentsAPI: list, createIntent, onboard, payout
    └── chat.ts                # Socket.IO: getSocket, sendMessage, onNewMessage
```

### Variabile d'ambiente mobile

```
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1   # default
EXPO_PUBLIC_STRIPE_PK=pk_test_...
```

---

## Regola mock

Ogni variabile d'ambiente assente assume il valore `"mock"`.
`isMock('STRIPE_SECRET_KEY')` → `true` → usa `StripeMock`.
L'app parte e risponde senza nessun servizio esterno attivo.

```
DATABASE_URL        → mock → PostgresMock (SQL parser in-memory)
MONGO_URI           → mock → mongodb-memory-server
REDIS_URL           → mock → RedisMock (Map + geo in memoria)
STRIPE_SECRET_KEY   → mock → StripeMock (paymentIntents/accounts/transfers)
FIREBASE_PROJECT_ID → mock → FirebaseMock (🔔 console log)
```

### Seed predefinito (mock)

| Ruolo | Email | ID |
|---|---|---|
| admin | admin@artisan.dev | usr_admin_001 |
| client | cliente@artisan.dev | usr_client_001 |
| artisan | artigiano@artisan.dev | usr_artisan_001 |

Job seed: `job_001` (completed), `job_002` (pending) — entrambi categoria `idraulico`, Roma.
