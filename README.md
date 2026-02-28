<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Coalition Brand - E-commerce Platform

Premium streetwear e-commerce platform built with React, Vite, and Stripe.

## Features

- 🛍️ **Product Catalog** - Browse and shop premium streetwear
- 💳 **Stripe Checkout** - Secure payment processing with card and crypto options
- 📧 **Order Confirmation** - Automated email receipts via Resend
- 🪙 **SGCoin Rewards** - Loyalty program with every purchase
- 🔗 **NFT Integration** - Products linked to Polygon NFTs
- 📱 **Responsive Design** - Mobile-first, beautiful UI

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Vanilla CSS with modern design
- **Payments**: Stripe (Card + Crypto)
- **Email**: Resend API
- **Blockchain**: Ethers.js for Web3 integration
- **Deployment**: Vercel

## Local Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Stripe account (test mode)
- Resend account (optional for emails)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` file:
   ```env
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
   STRIPE_SECRET_KEY=sk_test_your_key
   RESEND_API_KEY=re_your_key
   VITE_APP_URL=http://localhost:3000
   ```

4. Start the API server:
   ```bash
   node server.js
   ```

5. Start the dev server (in a new terminal):
   ```bash
   npm run dev
   ```

6. Open http://localhost:3000

### Testing Checkout

Use Stripe test cards:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- Any future expiry date and CVC

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

Quick deploy to Vercel:
```bash
vercel
```

## Project Structure

```
├── api/                    # Vercel serverless functions
├── components/             # React components
├── context/               # React context providers
├── pages/                 # Page components
├── public/                # Static assets
├── services/              # API services
├── server.js              # Local API server
├── vite.config.ts         # Vite configuration
└── vercel.json            # Vercel deployment config
```

## Environment Variables

### Development (.env.local)
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe test publishable key
- `STRIPE_SECRET_KEY` - Stripe test secret key
- `RESEND_API_KEY` - Resend API key
- `VITE_APP_URL` - Local development URL

### Production (Vercel Dashboard)
- Same variables but with LIVE Stripe keys
- Update `VITE_APP_URL` to your production domain

## Contributing

This is a private project. For questions, contact the development team.

## License

All rights reserved © 2024 Coalition Brand
