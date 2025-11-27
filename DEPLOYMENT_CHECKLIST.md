# Vercel Deployment Checklist

## Pre-Deployment

- [ ] **Database Migration Applied**
  - Ran `supabase_migration.sql` ✅
  - Ran `supabase_production_security.sql` (RLS policies)
  
- [ ] **Environment Variables Ready**
  - Stripe live publishable key (`pk_live_...`)
  - Stripe live secret key (`sk_live_...`)
  - Stripe webhook secret (`whsec_...`)
  - Supabase URL and anon key (already set)
  - Production app URL

- [ ] **Code Review**
  - No console.logs with sensitive data
  - No hardcoded secrets
  - Admin password changed from default
  - CORS configured for production domain

## Deployment Steps

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login
```bash
vercel login
```

### 3. Deploy
```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

### 4. Configure Environment Variables

Go to Vercel Dashboard → Settings → Environment Variables

Add each variable from `.env.production.template`

### 5. Redeploy with Environment Variables
```bash
vercel --prod
```

## Post-Deployment

- [ ] **Test Payment Flow**
  - Add product to cart
  - Complete checkout with test card
  - Verify order appears in admin
  
- [ ] **Verify Webhook**
  - Check Stripe Dashboard → Webhooks
  - Confirm events are being received
  
- [ ] **Test Admin Panel**
  - Login to admin
  - Create/update/delete product
  - View orders
  
- [ ] **Monitor Logs**
  ```bash
  vercel logs --prod
  ```

- [ ] **Check Performance**
  - Page load times
  - API response times
  - Database query performance

## Quick Commands

```bash
# View deployment URL
vercel ls

# View logs
vercel logs --prod

# View environment variables
vercel env ls

# Remove deployment
vercel rm [deployment-url]
```

## Troubleshooting

### Deployment fails
- Check build logs: `vercel logs`
- Verify `package.json` scripts
- Ensure all dependencies are in `dependencies`, not `devDependencies`

### Environment variables not working
- Redeploy after adding variables
- Check variable names match exactly (case-sensitive)
- Verify variables are set for "Production" environment

### Stripe webhook not working
- Update webhook URL in Stripe Dashboard
- Verify endpoint is accessible
- Check webhook secret matches

## Support

- Vercel Status: https://www.vercel-status.com
- Vercel Docs: https://vercel.com/docs
- Community: https://github.com/vercel/vercel/discussions
