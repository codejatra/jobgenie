'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Calendar, 
  DollarSign, 
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Receipt,
  TrendingUp,
  Download,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Purchase {
  id: string;
  credits: number;
  amount: number;
  currency: string;
  status: string;
  paymentStatus?: string;
  stripeSessionId?: string;
  customerEmail?: string;
  createdAt: Date;
}

export default function PurchaseHistoryPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalCredits, setTotalCredits] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPurchases = () => {
    if (!user) return;

    setRefreshing(true);
    
    const q = query(
      collection(db, 'purchases'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log('Fetched purchases:', snapshot.docs.length);
        
        const purchaseData = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Purchase data:', data); // Debug log
          
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            // Ensure status is set correctly
            status: data.status || data.paymentStatus || 'completed',
          } as Purchase;
        });
        
        setPurchases(purchaseData);
        
        // Calculate totals
        let spent = 0;
        let credits = 0;
        
        purchaseData.forEach(p => {
          // Check if purchase is completed
          const isCompleted = p.status === 'completed' || p.paymentStatus === 'completed';
          
          if (isCompleted) {
            // Amount is stored in cents, convert to dollars
            const amount = p.amount || 0;
            spent += amount > 0 ? amount / 100 : 0;
            
            // Add credits
            credits += p.credits || 0;
          }
        });
        
        console.log('Total spent:', spent);
        console.log('Total credits:', credits);
        
        setTotalSpent(spent);
        setTotalCredits(credits);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error('Error fetching purchases:', error);
        toast.error('Failed to load purchase history');
        setLoading(false);
        setRefreshing(false);
      }
    );

    return unsubscribe;
  };

  useEffect(() => {
    const unsubscribe = fetchPurchases();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const handleRefresh = () => {
    fetchPurchases();
    toast.success('Refreshed purchase history');
  };

  const getStatusIcon = (status: string) => {
    const isCompleted = status === 'completed' || status === 'paid';
    if (isCompleted) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (status === 'failed') {
      return <XCircle className="w-5 h-5 text-red-500" />;
    } else {
      return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    const isCompleted = status === 'completed' || status === 'paid';
    if (isCompleted) {
      return 'text-green-400 bg-green-900/20';
    } else if (status === 'failed') {
      return 'text-red-400 bg-red-900/20';
    } else {
      return 'text-yellow-400 bg-yellow-900/20';
    }
  };

  const getStatusText = (status: string) => {
    const isCompleted = status === 'completed' || status === 'paid';
    if (isCompleted) return 'Completed';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatAmount = (amount: number, currency: string) => {
    // Amount is in cents, convert to dollars
    const dollars = amount / 100;
    return `$${dollars.toFixed(2)} ${(currency || 'usd').toUpperCase()}`;
  };

  const downloadReceipt = (purchase: Purchase) => {
    const amount = (purchase.amount / 100).toFixed(2);
    const receiptContent = `
JOBGENIE RECEIPT
================

Date: ${format(purchase.createdAt, 'PPP')}
Time: ${format(purchase.createdAt, 'pp')}
Transaction ID: ${purchase.stripeSessionId || purchase.id}

Product Details:
----------------
Product: ${purchase.credits} Job Search Credits
Unit Price: $${(purchase.amount / 100 / purchase.credits).toFixed(2)}
Quantity: ${purchase.credits}
Total Amount: $${amount} ${(purchase.currency || 'USD').toUpperCase()}

Payment Status: ${getStatusText(purchase.status)}
Payment Method: Credit Card

Customer Email: ${purchase.customerEmail || user?.email || 'N/A'}

Thank you for your purchase!
For support, contact: support@jobgenie.com
    `;

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JobGenie-Receipt-${purchase.id.substring(0, 8)}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Receipt downloaded');
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gray-900/50 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Purchase History</h1>
              <p className="text-gray-400 mt-2">View your credit purchases and transactions</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-green-900/20 to-gray-800/50 backdrop-blur-md rounded-xl p-6 border border-green-700/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Total Spent</p>
                <p className="text-3xl font-bold text-white mt-2">
                  ${totalSpent.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {purchases.length > 0 ? 'All time' : 'No purchases yet'}
                </p>
              </div>
              <div className="p-3 bg-green-600/20 rounded-lg">
                <DollarSign className="w-8 h-8 text-green-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-900/20 to-gray-800/50 backdrop-blur-md rounded-xl p-6 border border-purple-700/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Total Credits</p>
                <p className="text-3xl font-bold text-white mt-2">{totalCredits}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {totalCredits > 0 ? 'Purchased credits' : 'No credits purchased'}
                </p>
              </div>
              <div className="p-3 bg-purple-600/20 rounded-lg">
                <Package className="w-8 h-8 text-purple-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-blue-900/20 to-gray-800/50 backdrop-blur-md rounded-xl p-6 border border-blue-700/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Transactions</p>
                <p className="text-3xl font-bold text-white mt-2">{purchases.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {purchases.length > 0 ? 'Total purchases' : 'No transactions'}
                </p>
              </div>
              <div className="p-3 bg-blue-600/20 rounded-lg">
                <TrendingUp className="w-8 h-8 text-blue-400" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Purchase History Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-800/50 backdrop-blur-md rounded-2xl border border-gray-700 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white flex items-center">
              <Receipt className="w-5 h-5 mr-2 text-purple-400" />
              Transaction History
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <CreditCard className="w-8 h-8 text-purple-500" />
              </motion.div>
            </div>
          ) : purchases.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900/50 border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Credits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Receipt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {purchases.map((purchase, index) => (
                    <motion.tr
                      key={purchase.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.5) }}
                      className="hover:bg-gray-900/30 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="text-white font-medium">
                            {format(purchase.createdAt, 'PPP')}
                          </div>
                          <div className="text-gray-400 text-xs">
                            {format(purchase.createdAt, 'p')}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="w-4 h-4 mr-2 text-purple-400" />
                          <span className="text-white font-semibold text-lg">{purchase.credits}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-green-400 font-semibold">
                          {formatAmount(purchase.amount, purchase.currency)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(purchase.status)}`}>
                          {getStatusIcon(purchase.status)}
                          <span className="ml-1.5">{getStatusText(purchase.status)}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => downloadReceipt(purchase)}
                          className="inline-flex items-center px-3 py-1 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors"
                          title="Download Receipt"
                        >
                          <Download className="w-4 h-4 mr-1.5" />
                          <span className="text-xs font-medium">Download</span>
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-20">
              <CreditCard className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No purchases yet</h3>
              <p className="text-gray-400 mb-6">
                Your purchase history will appear here after you buy credits
              </p>
              <a
                href="/dashboard/billing"
                className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Buy Credits
              </a>
            </div>
          )}
        </motion.div>

       
      </div>
    </div>
  );
}