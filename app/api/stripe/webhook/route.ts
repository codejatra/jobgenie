import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

// This is important for Vercel deployment
export const runtime = 'nodejs';

// Disable body parsing, we need the raw body for webhook verification
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  console.log('Webhook event received:', event.type);

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        
        console.log('Checkout session completed:', session.id);
        console.log('Metadata:', session.metadata);
        
        // Update user credits
        const userId = session.metadata?.userId;
        const credits = parseInt(session.metadata?.credits || '0');
        
        if (userId && credits > 0) {
          try {
            // Update user credits
            const userRef = adminDb.collection('users').doc(userId);
            await userRef.update({
              credits: FieldValue.increment(credits),
              updatedAt: FieldValue.serverTimestamp(),
            });

            // Save purchase history
            await adminDb.collection('purchases').add({
              userId,
              credits,
              amount: session.amount_total,
              currency: session.currency,
              stripeSessionId: session.id,
              customerEmail: session.customer_email,
              paymentStatus: session.payment_status,
              status: 'completed',
              createdAt: FieldValue.serverTimestamp(),
            });

            console.log(`Successfully added ${credits} credits to user ${userId}`);
          } catch (error) {
            console.error('Error updating user credits:', error);
            // Don't return error to Stripe, log it for investigation
          }
        }
        break;

      case 'payment_intent.succeeded':
        console.log('Payment intent succeeded');
        break;

      case 'payment_intent.payment_failed':
        const failedSession = event.data.object as Stripe.PaymentIntent;
        console.log('Payment failed:', failedSession.id);
        
        // Log failed payment
        if (failedSession.metadata?.userId) {
          await adminDb.collection('purchases').add({
            userId: failedSession.metadata.userId,
            amount: failedSession.amount,
            currency: failedSession.currency,
            stripePaymentIntentId: failedSession.id,
            status: 'failed',
            error: failedSession.last_payment_error?.message,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Don't return error to Stripe
  }

  return NextResponse.json({ received: true });
}