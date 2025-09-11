import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, priceId, credits } = body;

    console.log('Checkout request:', { userId, priceId, credits });

    // Validate inputs
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    if (!credits || credits <= 0) {
      return NextResponse.json(
        { error: 'Invalid credits amount' },
        { status: 400 }
      );
    }

    // Verify the price exists in Stripe
    let price;
    try {
      price = await stripe.prices.retrieve(priceId);
      console.log('Price verified:', price.id);
    } catch (error: any) {
      console.error('Price verification failed:', error);
      return NextResponse.json(
        { error: `Invalid price: ${priceId}. Please contact support.` },
        { status: 400 }
      );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success&credits=${credits}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?payment=cancelled`,
      metadata: {
        userId,
        credits: credits.toString(),
      },
    });

    console.log('Checkout session created:', session.id);

    return NextResponse.json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create checkout session',
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      { status: 500 }
    );
  }
}