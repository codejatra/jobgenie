const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function checkStripeSetup() {
  try {
    console.log('🔍 Checking Stripe configuration...\n');
    
    // List all products
    console.log('📦 Products:');
    const products = await stripe.products.list({ limit: 10 });
    
    if (products.data.length === 0) {
      console.log('❌ No products found. Please run setup-stripe.js first.');
      return;
    }
    
    products.data.forEach(product => {
      console.log(`  - ${product.name} (${product.id})`);
    });
    
    // List all prices
    console.log('\n💰 Prices:');
    const prices = await stripe.prices.list({ limit: 10 });
    
    if (prices.data.length === 0) {
      console.log('❌ No prices found. Please run setup-stripe.js first.');
      return;
    }
    
    prices.data.forEach(price => {
      const amount = (price.unit_amount / 100).toFixed(2);
      console.log(`  - ${price.id}: $${amount} ${price.currency.toUpperCase()}`);
    });
    
    console.log('\n✅ Stripe is configured!');
    console.log('\n📝 Make sure these price IDs are in your .env.local file:');
    prices.data.forEach(price => {
      const amount = (price.unit_amount / 100).toFixed(2);
      if (amount === '9.99') {
        console.log(`NEXT_PUBLIC_STRIPE_PRICE_STARTER=${price.id}`);
      } else if (amount === '24.99') {
        console.log(`NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL=${price.id}`);
      } else if (amount === '69.99') {
        console.log(`NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE=${price.id}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking Stripe:', error.message);
  }
}

checkStripeSetup();