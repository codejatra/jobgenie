'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Check,
  Sparkles,
  TrendingUp,
  Package,
  Clock,
  AlertCircle
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import toast from 'react-hot-toast';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { getStripePrices } from '@/lib/config/stripe';

// Initialize Stripe with null check
const stripePromise = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface PricingPlan {
  id: string;
  name: string;
  credits: number;
  price: number;
  priceId: string;
  popular?: boolean;
  savings?: string;
}

interface UsageHistory {
  id: string;
  type: string;
  timestamp: Date;
}

export default function BillingPage() {
  const { user, profile } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [usageHistory, setUsageHistory] = useState<UsageHistory[]>([]);
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
  const [pricesLoaded, setPricesLoaded] = useState(false);

  // Load pricing plans with actual Stripe price IDs
  useEffect(() => {
    const prices = getStripePrices();

    const plans: PricingPlan[] = [
      {
        id: 'starter',
        name: 'Starter',
        credits: 10,
        price: 9.99,
        priceId: prices.starter,
      },
      {
        id: 'professional',
        name: 'Professional',
        credits: 30,
        price: 24.99,
        priceId: prices.professional,
        popular: true,
        savings: 'Save 17%',
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        credits: 100,
        price: 69.99,
        priceId: prices.enterprise,
        savings: 'Save 30%',
      },
    ];

    setPricingPlans(plans);
    setPricesLoaded(true);

    // Log for debugging
    if (typeof window !== 'undefined') {
      console.log('Stripe prices loaded:', prices);
      console.log('Environment:', process.env.NODE_ENV);
    }
  }, []);

  // Fetch usage history
  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'usage'),
          where('userId', '==', user.uid),
          limit(10)
        );

        const snapshot = await getDocs(q);
        const history = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate(),
        })) as UsageHistory[];

        // Sort client-side
        history.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
        setUsageHistory(history);
      } catch (error) {
        console.error('Error fetching usage history:', error);
        setUsageHistory([]);
      }
    };

    fetchHistory();
  }, [user]);

  const handlePurchase = async (plan: PricingPlan) => {
    // Check if we're in development mode
    const isDevelopment = window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (!isDevelopment && window.location.protocol !== 'https:') {
      toast.error('Secure connection required for payments. Please use HTTPS.');
      return;
    }

    if (!user) {
      toast.error('Please login to purchase credits');
      return;
    }

    if (!plan.priceId || plan.priceId.includes('YOUR_ACTUAL')) {
      toast.error('Payment system is not configured. Please contact support.');
      console.error('Invalid price ID:', plan.priceId);
      return;
    }

    if (!stripePromise) {
      toast.error('Payment system is not available. Please try again later.');
      return;
    }

    setLoading(true);
    setSelectedPlan(plan);

    try {
      console.log('Creating checkout session for:', plan);

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          priceId: plan.priceId,
          credits: plan.credits,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { sessionId } = data;
      console.log('Checkout session created:', sessionId);

      // In handlePurchase function, after getting sessionId:
      if (typeof window !== 'undefined') {
        localStorage.setItem('pending_session_id', sessionId);
      }

      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast.error(error.message || 'Failed to process payment. Please try again.');
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  // Show warning if in development
  const isDevelopment = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-900/50 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-white">Billing & Credits</h1>
          <p className="text-gray-400 mt-2">Manage your credits and subscription</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        {/* Development Mode Warning */}
        {isDevelopment && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-4 mb-6 flex items-start space-x-3"
          >
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="text-yellow-200 font-semibold">Test Mode</p>
              <p className="text-yellow-300 text-sm">
                You're in development mode. Use Stripe test cards for payments.
                Test card: 4242 4242 4242 4242
              </p>
            </div>
          </motion.div>
        )}

        {/* Current Balance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-900 to-pink-900 rounded-2xl p-8 mb-12"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">Current Balance</h2>
              <div className="flex items-baseline space-x-2">
                <span className="text-5xl font-bold text-white">{profile?.credits || 0}</span>
                <span className="text-xl text-purple-200">credits</span>
              </div>
              <p className="text-purple-200 mt-2">
                {profile?.credits === 0
                  ? "You're out of credits. Purchase more to continue searching."
                  : `You have ${profile?.credits} job searches remaining.`}
              </p>
            </div>
            <Sparkles className="w-20 h-20 text-purple-300 opacity-50" />
          </div>
        </motion.div>

        {/* Pricing Plans */}
        {pricesLoaded ? (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-8 text-center">Choose Your Plan</h2>

            <div className="grid md:grid-cols-3 gap-6">
              {pricingPlans.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className={`relative bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border ${plan.popular
                      ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                      : 'border-gray-700'
                    }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        MOST POPULAR
                      </span>
                    </div>
                  )}

                  {plan.savings && (
                    <div className="absolute -top-3 right-4">
                      <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-lg">
                        {plan.savings}
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <Package className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                    <div className="flex items-baseline justify-center space-x-1">
                      <span className="text-4xl font-bold text-white">${plan.price}</span>
                    </div>
                    <p className="text-gray-400 mt-2">{plan.credits} Credits</p>
                    <p className="text-sm text-gray-500">
                      ${(plan.price / plan.credits).toFixed(2)} per search
                    </p>
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center text-gray-300">
                      <Check className="w-5 h-5 text-green-500 mr-2" />
                      <span>{plan.credits} job searches</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="w-5 h-5 text-green-500 mr-2" />
                      <span>AI-powered matching</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="w-5 h-5 text-green-500 mr-2" />
                      <span>Resume optimization</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="w-5 h-5 text-green-500 mr-2" />
                      <span>Cover letter generation</span>
                    </li>
                  </ul>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handlePurchase(plan)}
                    disabled={loading && selectedPlan?.id === plan.id || !plan.priceId}
                    className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center space-x-2 ${plan.popular
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-xl hover:shadow-purple-500/25'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {loading && selectedPlan?.id === plan.id ? (
                      <span>Processing...</span>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        <span>Purchase</span>
                      </>
                    )}
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex justify-center items-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-8 h-8 text-purple-500" />
            </motion.div>
          </div>
        )}

        {/* Usage History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Recent Activity</h2>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>

          {usageHistory.length > 0 ? (
            <div className="space-y-3">
              {usageHistory.map((usage) => (
                <div
                  key={usage.id}
                  className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0"
                >
                  <div className="flex items-center space-x-3">
                    <TrendingUp className="w-4 h-4 text-purple-400" />
                    <div>
                      <p className="text-white">Job Search</p>
                      <p className="text-sm text-gray-400">
                        {usage.timestamp?.toLocaleDateString()} at{' '}
                        {usage.timestamp?.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-gray-400">-1 credit</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8">
              No usage history yet. Start searching for jobs!
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}