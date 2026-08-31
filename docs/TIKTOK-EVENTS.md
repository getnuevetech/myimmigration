# TikTok Ads — Pixel + Events API (Imm1)

**Pixel ID:** `DAASLUJC77U47UVQELH0`  
**Pixel name:** Imm1

## Browser pixel

Already loaded sitewide via `src/components/tiktok-pixel.tsx` (setting `analytics.tiktok_pixel_id`).

Landing URLs from TikTok ads should keep `?ttclid=…` — captured into a cookie by `TikTokClickIdCapture`.

## Events API (server)

1. In TikTok Events Manager → Imm1 → **Generate access token** (copy once; TikTok will not show it again).
2. Set one of:
   - Admin setting **`analytics.tiktok_access_token`** (secret), or
   - Env `TIKTOK_ACCESS_TOKEN` in `.env.deploy` / Lightsail
3. Redeploy / restart so the setting is available.

Endpoint used: `POST https://business-api.tiktok.com/open_api/v1.3/event/track/`  
Implementation: `src/lib/tiktok-events.ts`

## Event map (ImmigrationOnMe)

| TikTok event | When we fire it |
| --- | --- |
| **Pageview** | Every page (`ttq.page()` + Events API mirror) |
| **ViewContent** | `/pricing`, `/start` (browser + server bridge) |
| **ClickButton** | Header “Start free →” (and same event_id to Events API) |
| **Search** | Q&A ask (`askQuestionAction`) |
| **Contact** | Support ticket created |
| **Lead** | Situation intake created; consultant match requested |
| **AddToWishlist** | “Keep these answers as my options review” |
| **CompleteRegistration** | Email or Google signup |
| **AddToCart** | Pricing “Choose {plan}”; PlanPicker submit (paid plans) |
| **InitiateCheckout** | PlanPicker submit + `subscribeAction` before Stripe/manual charge |
| **CompletePayment** | `activateSubscription` (TikTok’s Purchase analogue) + billing success page pixel |

Emails / phones / external ids are **SHA-256 hashed** before send. Raw PII is never posted to TikTok.

Browser + server share the same `event_id` for AddToCart / InitiateCheckout so TikTok can dedupe.

### Commerce funnel note

TikTok Events Manager labels the purchase step **Purchase**. The Events API / Pixel standard name is **`CompletePayment`** — that is what we send. Do not send a literal `Purchase` event name.

Without an access token, server events are **skipped** (pixel page views and browser `ttq.track` still work).

## Verify

- TikTok Events Manager → Test events / diagnostics  
- Browser network: pixel `ttq` + optional `POST /api/tiktok/event`  
- Server logs: `[tiktok-events]` warnings if the token is missing or TikTok returns an error  
- Walk the funnel once after deploy: open `/pricing` → Choose plan → Get plan → confirm success banner  

Check script: `npx tsx scripts/tiktok-events-api-check.ts`
