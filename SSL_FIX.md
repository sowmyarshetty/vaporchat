# SSL Certificate Error Fix

If you're seeing `unable to get local issuer certificate` errors, this is usually caused by:
- Corporate network/proxy intercepting SSL
- Missing system certificates
- Firewall blocking SSL verification

## Quick Fix (Development Only)

Add this to your `.env.local` file:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0
```

⚠️ **WARNING**: This disables SSL verification. **Only use in development!**

Then restart your dev server:
```bash
npm run dev
```

## Better Solution (Recommended)

### Option 1: Update Node.js Certificates

```bash
# Windows (PowerShell as Admin)
npm config set cafile ""
npm config set strict-ssl false
```

Then restart your dev server.

### Option 2: Use a Different Network

If you're on a corporate network, try:
- Using a personal hotspot
- Connecting to a different network
- Contacting IT to whitelist Supabase domains

### Option 3: Install Certificates (Advanced)

1. Export your corporate CA certificate
2. Set `NODE_EXTRA_CA_CERTS` environment variable pointing to the certificate file

## For Production (Vercel)

This issue typically doesn't occur on Vercel's infrastructure. If it does:
1. Check Vercel environment variables are set correctly
2. Verify Supabase project is accessible
3. Check Vercel function logs for detailed errors

## Verify It's Fixed

After applying the fix, try creating a room. The error should be gone.
