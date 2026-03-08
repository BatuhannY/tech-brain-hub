

## Diagnosis: Edge Functions Failing in Incognito Mode

### Root Cause

The error "Edge Function returned a non-2xx status code" in incognito happens because **Lovable Cloud uses ES256 token signing**, which can conflict with the gateway's JWT verification even when `verify_jwt = false` is set in `config.toml`. In incognito, there's no authenticated session, so the Supabase client sends only the anon key as a Bearer token. The gateway may still attempt to validate this token and reject it.

**Yes, this means other people currently cannot use the AI features of your project.**

### The Fix

The solution is to explicitly handle authentication inside each edge function (since `verify_jwt = false` is already set) and ensure the functions gracefully accept unauthenticated requests, since this is a public-facing tool without login.

### Changes Required

1. **All 5 edge functions** (`ai-chat`, `ai-analytics`, `ai-search`, `ai-categorize`, `ai-copilot`) need to be updated:
   - Keep `verify_jwt = false` in `config.toml` (already done)
   - Ensure none of the functions reject requests based on missing auth headers
   - Force redeploy all functions to ensure the latest `config.toml` settings are applied

2. **Redeploy edge functions** by making a minor update to each function file (e.g., updating the version comment), which triggers automatic redeployment with the correct `verify_jwt = false` gateway configuration.

3. **Verify** the functions work from an unauthenticated context by testing the AI chat in incognito after deployment.

### What This Means

- The project will work for anyone with the link, no login required
- All AI features (chat, search, analytics, FAQ, etc.) will be accessible publicly
- The edge functions use server-side API keys (`LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) so security of those keys is maintained regardless

