const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function setupStripeProducts() {
  try {
    console.log('Creating Stripe products and prices...');

    // Create products
    const starterProduct = await stripe.products.create({
      name: 'JobGenie Starter Pack',
      description: '10 AI-powered job searches',
    });

    const professionalProduct = await stripe.products.create({
      name: 'JobGenie Professional Pack',
      description: '30 AI-powered job searches',
    });

    const enterpriseProduct = await stripe.products.create({
      name: 'JobGenie Enterprise Pack',
      description: '100 AI-powered job searches',
    });

    // Create prices
    const starterPrice = await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: 999, // $9.99 in cents
      currency: 'usd',
    });

    const professionalPrice = await stripe.prices.create({
      product: professionalProduct.id,
      unit_amount: 2499, // $24.99 in cents
      currency: 'usd',
    });

    const enterprisePrice = await stripe.prices.create({
      product: enterpriseProduct.id,
      unit_amount: 6999, // $69.99 in cents
      currency: 'usd',
    });

    console.log('✅ Products and prices created successfully!');
    console.log('\n📝 Add these to your .env.local file:');
    console.log(`STRIPE_PRICE_STARTER=${starterPrice.id}`);
    console.log(`STRIPE_PRICE_PROFESSIONAL=${professionalPrice.id}`);
    console.log(`STRIPE_PRICE_ENTERPRISE=${enterprisePrice.id}`);

    return {
      starterPrice: starterPrice.id,
      professionalPrice: professionalPrice.id,
      enterprisePrice: enterprisePrice.id,
    };
  } catch (error) {
    console.error('Error creating Stripe products:', error);
  }
}

setupStripeProducts();