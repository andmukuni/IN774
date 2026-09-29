# Airtel Zambia phone verification

Standalone checker for an Airtel Money subscriber. It signs in with OAuth 2.0 client credentials, then calls the KYC user enquiry:

`GET /standard/v1/users/{msisdn}`

Staging: `https://openapiuat.airtel.co.zm`  
Production: `https://openapi.airtel.co.zm`

The page and the HTTP API never receive the Airtel client secret. Recent lookups are stored only in a local file.

## Run

```bash
cd airtel-kyc
cp .env.example .env
npm start
```

Open http://localhost:8787

Put the consumer key and consumer secret from the Airtel Money developer portal (select Zambia) in `.env`:

```bash
AIRTEL_ENV=staging
AIRTEL_CLIENT_ID=your-consumer-key
AIRTEL_CLIENT_SECRET=your-consumer-secret
AIRTEL_COUNTRY=ZM
AIRTEL_CURRENCY=ZMW
```

Switch `AIRTEL_ENV` to `production` when Airtel has approved the live app. Set `ACCESS_KEY` before anyone else can reach the server. That same value is the browser sign-in password and the API key.

Check one number from the terminal:

```bash
npm run check -- 0971234567
```

Run without Docker dependencies. The app uses Node.js 22 and the built-in HTTP client.

```bash
docker compose up --build
```

## What a lookup does

1. `POST /auth/oauth2/token` with `client_id`, `client_secret`, and `grant_type=client_credentials`.
2. Cache the bearer token until shortly before `expires_in`.
3. `GET /standard/v1/users/{msisdn}` with `Accept`, `X-Country`, `X-Currency`, and `Authorization: Bearer …`.
4. If Airtel answers `401`, refresh the token once and retry.

The MSISDN is normalized from `0971234567`, `971234567`, or `+260971234567`. By default Airtel receives the 9-digit national number (`971234567`). Change `AIRTEL_MSISDN_FORMAT` to `local` or `international` if your app registration expects another form.

Numbers outside the usual Airtel ranges `057`, `077`, and `097` still get sent. The result includes a warning so a mistyped network is visible.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness, no key required |
| `GET` | `/api/status` | Environment, country, currency, and whether credentials exist |
| `POST` | `/api/connection` | Confirms Airtel will issue a token. The token is not returned |
| `POST` | `/api/verify` | Body: `{ "msisdn": "0971234567" }` |
| `GET` | `/api/verifications` | Latest local results |
| `POST` | `/api/session` | Body: `{ "accessKey": "…" }` sets an HttpOnly session cookie |
| `DELETE` | `/api/session` | Clears the session |

When `ACCESS_KEY` is set, send it as `X-Api-Key` or `Authorization: Bearer <key>`.

```bash
curl -s -X POST http://localhost:8787/api/verify \
  -H 'Content-Type: application/json' \
  -H 'X-Api-Key: your-access-key' \
  -d '{"msisdn":"0971234567"}'
```

A completed lookup returns `verdict`:

- `verified` — subscriber returned and the wallet is not barred
- `barred` — subscriber exists and `is_barred` is true
- `not_registered` — registration status is unregistered or inactive
- `not_verified` — Airtel refused the number (`status.success` false)
- `error` — token, network, or unreadable response

## Mock mode

Set `AIRTEL_MOCK=true` to exercise the page without credentials. These endings are simulated:

| Number ending | Result |
| --- | --- |
| `0000` | Not verified |
| `1111` | Barred |
| `2222` | Not registered |
| anything else | Verified as Mutale Phiri |

## Tests

```bash
npm test
```
