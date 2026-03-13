# Unitech Cabels Metal Intelligence

A Vercel-ready dashboard for metal price analytics, forecasting, vendor quote onboarding, and low-price seller scanning.

## Features
- Copper and industrial metal tracking (LME symbols via Metals-API)
- Trend, volatility, RSI, support/resistance, and buy-signal logic
- 30/90/365/730-day range analysis
- 30-day forecast (linear regression with confidence band)
- Seller intelligence via Google Shopping results (SerpAPI)
- Vendor onboarding and landed cost comparison
- Email/WhatsApp alerts with cron-friendly runner
- Workspace access via shared keys

## Data Sources
- **Metals-API**: Timeseries endpoint for metal prices by symbol.
- **FRED**: Macro series fallback (copper is configured by default).
- **SerpAPI**: Google Shopping results for seller/price discovery.

## Environment Variables
Create these in Vercel or your local `.env.local`.

### Core
- `METALS_API_KEY` — required for Metals-API pricing
- `FRED_API_KEY` — required for FRED pricing
- `SERPAPI_KEY` — required for seller scan
- `SESSION_SECRET` — HMAC secret for signed sessions
- `DEFAULT_WORKSPACE_KEY` — shared workspace key (fallback when `WORKSPACES_JSON` is not set)
- `WORKSPACES_JSON` — optional JSON array for multiple workspaces

Example:
```json
[
  {
    "id": "unitech",
    "name": "Unitech Cabels",
    "key": "your-shared-key",
    "defaultLocation": "United States",
    "defaultCurrency": "USD"
  }
]
```

### Storage
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` — use Vercel KV for durable storage
- `LOCAL_STORE_PATH` — optional JSON file path for local persistence

### Alerts
- `ALERT_FROM_EMAIL` — sender email address
- `RESEND_API_KEY` or `SENDGRID_API_KEY` — email delivery
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` — WhatsApp delivery
- `CRON_SECRET` — optional secret for the alert runner endpoint

## Local Development
```bash
npm install
npm run dev
```

## Deploy to Vercel
1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Add the environment variables above.
4. Deploy.

## Alert Runner (Cron)
Trigger alerts by calling:

`/api/alerts/run?secret=YOUR_CRON_SECRET`

Set a Vercel Cron to hit this endpoint at your preferred interval.

## Notes
- Metals-API free plans limit timeseries windows. The API route chunks requests into 30-day windows.
- FRED data is typically lower frequency than daily and is best for macro trend context.
- Seller intelligence results depend on the shopping search query and location.
- For production data persistence, use Vercel KV or another database.

## Branding
The app is branded as **Unitech Cabels Metal Intelligence**. Rename as needed.
