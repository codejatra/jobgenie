import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

export async function POST(req: NextRequest) {
  try {
    const { sessionId, userId } = await req.json();

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'Session ID and User ID are required' },
        { status: 400 }
      );
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const credits = parseInt(session.metadata?.credits || '0');

      if (credits > 0) {
        // For local development, use client SDK
        const { doc, updateDoc, increment, addDoc, collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase/config');

        // Check if already processed
        const purchasesQuery = query(
          collection(db, 'purchases'),
          where('stripeSessionId', '==', session.id)
        );
        const existingPurchases = await getDocs(purchasesQuery);

        if (existingPurchases.empty) {
          // Update credits
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, {
            credits: increment(credits),
            updatedAt: new Date(),
          });

          // Save purchase record with correct format
          await addDoc(collection(db, 'purchases'), {
            userId,
            credits,
            amount: session.amount_total, // This is in cents
            currency: session.currency,
            stripeSessionId: session.id,
            customerEmail: session.customer_details?.email,
            paymentStatus: 'completed',
            status: 'completed', // Make sure status is 'completed'
            createdAt: new Date(),
          });

          console.log(`Added ${credits} credits to user ${userId}`);
          console.log(`Amount: ${session.amount_total} (in cents)`);

          return NextResponse.json({
            success: true,
            message: `${credits} credits added successfully`,
            credits
          });
        } else {
          return NextResponse.json({
            success: true,
            message: 'Payment already processed'
          });
        }
      }
    }

    return NextResponse.json({
      success: false,
      message: 'Payment not completed or already processed'
    });
  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}