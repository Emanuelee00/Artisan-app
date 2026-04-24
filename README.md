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

## Avvio completo — passo per passo

### 1. Installa le dipendenze (solo backend, una volta sola)

```bash
cd /home/eielmini/Documents/artisan/Artisan-app
npm install --workspace=packages/shared-types --workspace=apps/backend
```

> Il monorepo include anche Expo (mobile) e Next.js (admin) che richiedono 1–2 GB.
> Con poco spazio su disco, installa solo il backend che è sufficiente per tutto.

### 2. Avvia il server backend

```bash
npm run dev:mock
```

Output atteso:
```
BullMQ queues inizializzate [MOCK]
PostgreSQL [MOCK] connesso
MongoDB [MOCK] connesso (mongodb-memory-server)
Redis [MOCK] connesso
Server running on port 3000 [test]
```

### 3. Popola il database con i dati di test

```bash
curl -X POST http://localhost:3000/mock/seed
```

Credenziali create:
```
mario@test.it   / password123  → client
luigi@test.it   / password123  → artigiano (idraulico, Milano)
admin@test.it   / password123  → admin
```

### 4. Apri l'interfaccia web

```bash
xdg-open /home/eielmini/Documents/artisan/Artisan-app/test-app.html
# oppure trascina il file test-app.html nel browser
```

Nel campo **Server URL** della pagina di login:
- **Da questo PC** → `http://localhost:3000` (valore già precompilato)
- **Da telefono (stesso WiFi)** → `http://10.170.145.137:3000`

### 5. Resetta tutto (opzionale)

```bash
curl -X POST http://localhost:3000/mock/reset
# resetta il DB in-memory e ricrea automaticamente gli utenti di test
```

---

## Cosa puoi fare nell'interfaccia web

| Sezione | Funzionalità |
|---|---|
| **Dashboard** | KPI: lavori totali, in corso, completati, guadagni artigiano |
| **Lavori** | Crea lavori (client), accetta/avvia/completa (artigiano), cancella |
| **Pagamenti** | Storico pagamenti con fee piattaforma e payout artigiano |
| **Chat** | Messaggi per ogni lavoro con artigiano assegnato |
| **Mock State** | Vedi il DB in-memory, esegui seed/reset con un click |

---

## Avvio rapido (3 comandi, zero configurazione)

> Alternativa compatta alla sezione sopra, per chi ha già installato.

```bash
npm run dev:mock                         # avvia backend
curl -X POST localhost:3000/mock/seed    # popola DB
# apri test-app.html nel browser
```

Output atteso dopo `dev:mock`:
```
BullMQ queues inizializzate [MOCK]
PostgreSQL [MOCK] connesso
MongoDB [MOCK] connesso (mongodb-memory-server)
Redis [MOCK] connesso
Server running on port 3000 [test]
```

Credenziali di test dopo `npm run seed`:
```
[admin  ] admin@test.it   password: password123
[client ] mario@test.it   password: password123
[artisan] luigi@test.it   password: password123
```

### Dati pre-caricati dal seed

| Risorsa | Dettaglio |
|---|---|
| Job 1 | Completato — mario → luigi (idraulico, Milano) |
| Job 2 | In lavorazione (aperto) — mario → luigi |
| Job 3 | Accettato (aperto) — mario → luigi |
| Pagamento | Completato per Job 1, EUR 75.00 (fee 15%) |
| Chat | 3 messaggi nel Job 1 |

### Debug in-memory con il mock server

Con il server avviato, interroga lo stato interno da Postman/Bruno/curl:

```bash
# Vedi tutto lo stato in memoria
curl http://localhost:3000/mock/state | jq

# Resetta tutti i mock allo stato iniziale
curl -X POST http://localhost:3000/mock/reset

# Simula un webhook Stripe (pagamento riuscito)
curl -X POST http://localhost:3000/mock/stripe-event \
  -H 'Content-Type: application/json' \
  -d '{"type":"payment_intent.succeeded","object":{"id":"pi_mock_001"}}'
```

### Eseguire i test

```bash
npm run test:all                                             # tutti i moduli
cd apps/backend && npx vitest run src/modules/users/users.test.ts
cd apps/backend && npx vitest run src/modules/jobs/jobs.test.ts
cd apps/backend && npx vitest run src/modules/payments/payments.test.ts
```

### Applicare le migration (DB reale)

```bash
DATABASE_URL=postgresql://... npm run migrate
```

---

## Curl quick-reference

Sostituisci `<token>` con l'access token ottenuto dal login.

### Auth

```bash
# Registrazione
curl -X POST http://localhost:3000/api/v1/users/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Test1234!","name":"Test User","phone":"+39 333 0000000","role":"client"}'

# Login
curl -X POST http://localhost:3000/api/v1/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"mario@test.it","password":"password123"}'

# Profilo autenticato
curl http://localhost:3000/api/v1/users/me \
  -H 'Authorization: Bearer <token>'
```

### Jobs

```bash
# Lista jobs
curl http://localhost:3000/api/v1/jobs \
  -H 'Authorization: Bearer <token>'

# Crea job
curl -X POST http://localhost:3000/api/v1/jobs \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"title":"Perdita rubinetto","description":"Urgente.","category":"idraulico","address":"Via Roma 1, Milano","lat":45.46,"lng":9.19,"estimatedPrice":80}'

# Artigiani vicini (matching)
curl http://localhost:3000/api/v1/jobs/<jobId>/matches \
  -H 'Authorization: Bearer <token>'

# Completa job (artigiano)
curl -X PATCH http://localhost:3000/api/v1/jobs/<jobId>/complete \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"finalPrice":75}'
```

### Payments

```bash
# Crea payment intent
curl -X POST http://localhost:3000/api/v1/payments/intent \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"jobId":"<jobId>"}'

# Storico pagamenti
curl http://localhost:3000/api/v1/payments/history \
  -H 'Authorization: Bearer <token>'
```

### Chat

```bash
# Messaggi di un job
curl http://localhost:3000/api/v1/chat/<jobId>/messages \
  -H 'Authorization: Bearer <token>'

# Messaggi non letti
curl http://localhost:3000/api/v1/chat/unread \
  -H 'Authorization: Bearer <token>'
```

### TrustScore — Recensioni (`/api/v1/reviews`)

Sistema di reputazione degli artigiani. I clienti possono recensire un lavoro completato con 1-5 stelle e un commento. Il rating medio dell'artigiano viene aggiornato automaticamente in PostgreSQL.

| Metodo | Path | Auth | Ruolo | Note |
|---|---|---|---|---|
| POST | `/` | ✓ | client | Recensisce un job completato (una sola volta per job) |
| GET | `/artisan/:id` | ✓ | tutti | Lista paginata recensioni di un artigiano (`?page=1&limit=20`) |
| GET | `/artisan/:id/stats` | ✓ | tutti | Media, conteggio e distribuzione stelle (1-5) |
| GET | `/my` | ✓ | client | Recensioni lasciate dal cliente autenticato |

```bash
# Lascia una recensione (job deve essere completato)
curl -X POST http://localhost:3000/api/v1/reviews \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"jobId":"<jobId>","rating":5,"comment":"Puntuale e preciso, ottimo lavoro!"}'

# Recensioni di un artigiano
curl http://localhost:3000/api/v1/reviews/artisan/<artisanId> \
  -H 'Authorization: Bearer <token>'

# Statistiche rating
curl http://localhost:3000/api/v1/reviews/artisan/<artisanId>/stats \
  -H 'Authorization: Bearer <token>'
# → { "avg": 4.8, "count": 34, "distribution": { "5": 28, "4": 4, "3": 2, ... } }
```

**Regole di business:**
- Solo il cliente che ha commissionato il lavoro può recensire
- Il job deve essere in stato `completed`
- Una sola recensione per job (duplicati → 409)
- Dopo ogni recensione, `rating` e `review_count` dell'artigiano vengono ricalcolati in PostgreSQL

---

## Come aggiungere un nuovo modulo

Checklist da seguire per ogni nuovo dominio (es. `reviews`):

- [ ] **1. Tipi condivisi** — aggiungi l'interfaccia in `packages/shared-types/src/index.ts` ed esportala
- [ ] **2. Schema Zod** — crea `apps/backend/src/modules/reviews/reviews.schema.ts` con i DTO di input validati
- [ ] **3. Model** — crea `reviews.model.ts` con le query tipizzate verso Postgres o Mongoose (dipende dal dominio)
- [ ] **4. Service + Controller + Routes** — business logic pura nel service, handler Express nel controller, `Router` nelle routes
- [ ] **5. Registra il router** — aggiungi una riga in `apps/backend/src/gateway/router.ts`:
  ```typescript
  router.use('/reviews', reviewsRouter)
  ```

Regole da rispettare:
- Nessuna dipendenza circolare tra moduli
- Ogni file esterno (Stripe, Redis…) acceduto tramite il config con pattern mock
- Almeno un file `.test.ts` con i casi base (happy path + errore)

---

## Da mock a produzione

Checklist per passare dall'ambiente mock a servizi reali:

### Database
- [ ] Crea un'istanza PostgreSQL e copia la stringa di connessione in `DATABASE_URL`
- [ ] Crea un cluster MongoDB Atlas e copia l'URI in `MONGO_URI`
- [ ] Provisiona Redis (Upstash, Redis Cloud o self-hosted) e metti l'URL in `REDIS_URL`
- [ ] Esegui le migration: `DATABASE_URL=... npm run migrate`
- [ ] Esegui il seed: `DATABASE_URL=... MONGO_URI=... npm run seed`

### Stripe
- [ ] Crea account Stripe e copia la secret key in `STRIPE_SECRET_KEY`
- [ ] Configura il webhook su dashboard.stripe.com → Developers → Webhooks → endpoint: `POST /api/v1/payments/webhook`
- [ ] Copia il webhook signing secret in `STRIPE_WEBHOOK_SECRET`

### Firebase (push notifications)
- [ ] Crea progetto Firebase → Project settings → Service accounts → genera chiave JSON
- [ ] Imposta `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`

### Auth & sicurezza
- [ ] Genera un `JWT_SECRET` casuale (min 32 caratteri): `openssl rand -hex 32`
- [ ] Imposta `NODE_ENV=production`
- [ ] Imposta `FRONTEND_URL` con il dominio reale dell'app mobile/web

### Facoltativo
- [ ] Twilio (SMS): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- [ ] AWS S3 (PDF fatture): `S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- [ ] Google Maps (geocoding avanzato): `GOOGLE_MAPS_API_KEY`

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
