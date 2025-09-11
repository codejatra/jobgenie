// Stripe configuration
// Replace these with your actual Stripe price IDs from the check-stripe.js output
export const STRIPE_CONFIG = {
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  prices: {
    starter: 'price_1S5mEvBiAEe8BrCZTjePAOo3', // Replace with actual ID
    professional: 'price_1S5mEwBiAEe8BrCZymZfygWE', // Replace with actual ID
    enterprise: 'price_1S5mEwBiAEe8BrCZFcHTy57r', // Replace with actual ID
  }
};

// For development, you can use test price IDs
export const getStripePrices = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    console.log('Using Stripe test prices');
  }
  
  return {
    starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER || STRIPE_CONFIG.prices.starter,
    professional: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL || STRIPE_CONFIG.prices.professional,
    enterprise: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE || STRIPE_CONFIG.prices.enterprise,
  };
};