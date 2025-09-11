'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Sparkles,
  MapPin,
  DollarSign,
  Briefcase,
  Clock,
  Filter,
  Heart,
  ExternalLink,
  Building,
  Calendar
} from 'lucide-react';
import { searchJobs, refinePrompt, deductCredits, JobListing } from '@/lib/services/jobService';
import toast from 'react-hot-toast';
import JobDetailsModal from '@/components/JobDetailsModal';
import { saveFavoriteJob } from '@/lib/services/favoriteService';

export default function Dashboard() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [searchPrompt, setSearchPrompt] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [refinedParams, setRefinedParams] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // useEffect(() => {
  //   // Check for payment success
  //   const urlParams = new URLSearchParams(window.location.search);
  //   const paymentStatus = urlParams.get('payment');
  //   const credits = urlParams.get('credits');

  //   if (paymentStatus === 'success') {
  //     toast.success(`Payment successful! ${credits} credits added to your account.`);
  //     // Clean up URL
  //     window.history.replaceState({}, '', '/dashboard');

  //     // Verify payment if webhook didn't fire (for local testing)
  //     if (typeof window !== 'undefined') {
  //       const sessionId = localStorage.getItem('pending_session_id');
  //       if (sessionId && user) {
  //         fetch('/api/stripe/verify-payment', {
  //           method: 'POST',
  //           headers: { 'Content-Type': 'application/json' },
  //           body: JSON.stringify({ sessionId, userId: user.uid }),
  //         }).then(() => {
  //           localStorage.removeItem('pending_session_id');
  //         });
  //       }
  //     }
  //   }
  // }, [user]);

  // Add this useEffect at the top of your Dashboard component
  useEffect(() => {
    const verifyPayment = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentStatus = urlParams.get('payment');

      if (paymentStatus === 'success' && user) {
        // Get session ID from URL or storage
        const sessionId = urlParams.get('session_id') ||
          localStorage.getItem('pending_session_id');

        if (sessionId) {
          try {
            const response = await fetch('/api/stripe/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId,
                userId: user.uid
              }),
            });

            const data = await response.json();

            if (data.success) {
              toast.success(`Payment successful! ${data.credits || ''} credits added.`);
              localStorage.removeItem('pending_session_id');
            }
          } catch (error) {
            console.error('Payment verification error:', error);
          }
        }

        // Clean up URL
        window.history.replaceState({}, '', '/dashboard');
      }
    };

    if (user) {
      verifyPayment();
    }
  }, [user]);

  const handleSearch = async () => {
    if (!searchPrompt.trim()) {
      toast.error('Please enter a job search prompt');
      return;
    }

    if (!profile || profile.credits <= 0) {
      toast.error('Insufficient credits. Please purchase more credits.');
      router.push('/dashboard/billing');
      return;
    }

    setIsSearching(true);

    try {
      // Deduct credit first
      const creditDeducted = await deductCredits(user!.uid);
      if (!creditDeducted) {
        toast.error('Failed to process search. Please try again.');
        return;
      }

      // Refine the prompt
      toast.loading('Analyzing your search...', { id: 'search' });
      const refined = await refinePrompt(searchPrompt);
      setRefinedParams(refined);

      // Search for jobs
      toast.loading('Searching for jobs...', { id: 'search' });
      const results = await searchJobs(refined);

      setJobs(results);
      toast.success(`Found ${results.length} fresh job opportunities!`, { id: 'search' });
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search jobs. Please try again.', { id: 'search' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveJob = async (job: JobListing) => {
    try {
      await saveFavoriteJob(user!.uid, job);
      toast.success('Job saved to favorites!');
    } catch (error) {
      toast.error('Failed to save job');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-12 h-12 text-purple-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-900/50 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">



            <div className="flex items-center space-x-6 w-10 h-10">


            </div>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <h2 className="text-4xl font-bold text-white mb-2 text-center">
            Find Your Dream Job
          </h2>
          <p className="text-gray-400 text-center mb-8">
            Describe what you're looking for and let AI do the magic
          </p>

          {/* Search Input */}
          <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-8 border border-gray-700">
            <div className="relative">
              <textarea
                value={searchPrompt}
                onChange={(e) => setSearchPrompt(e.target.value)}
                placeholder="Example: I want a Flutter developer job with 3+ years experience in San Francisco, salary around $120k..."
                className="w-full px-6 py-4 bg-gray-900/50 text-white rounded-xl border border-gray-700 focus:border-purple-500 focus:outline-none resize-none h-32 placeholder-gray-500"
              />

              {/* Prompt Suggestions */}
              {searchPrompt && refinedParams && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 p-4 bg-purple-900/20 rounded-xl border border-purple-800"
                >
                  <p className="text-sm text-purple-400 mb-2">AI Suggestions:</p>
                  <div className="flex flex-wrap gap-2">
                    {refinedParams.location && (
                      <span className="px-3 py-1 bg-purple-800/30 text-purple-300 rounded-lg text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {refinedParams.location}
                      </span>
                    )}
                    {refinedParams.salary && (
                      <span className="px-3 py-1 bg-purple-800/30 text-purple-300 rounded-lg text-sm flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> {refinedParams.salary}
                      </span>
                    )}
                    {refinedParams.experience && (
                      <span className="px-3 py-1 bg-purple-800/30 text-purple-300 rounded-lg text-sm flex items-center gap-1">
                        <Briefcase className="w-3 h-3" /> {refinedParams.experience}
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSearch}
              disabled={isSearching}
              className="mt-6 w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold flex items-center justify-center space-x-2 hover:shadow-2xl hover:shadow-purple-500/25 transition-all disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-5 h-5" />
                  </motion.div>
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>Search Jobs</span>
                </>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Job Results */}
        <AnimatePresence>
          {jobs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-12"
            >
              <h3 className="text-2xl font-bold text-white mb-6">
                Fresh Opportunities ({jobs.length})
              </h3>

              <div className="grid gap-4">
                {jobs.map((job, index) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.01 }}
                    className="bg-gray-800/50 backdrop-blur-md rounded-xl p-6 border border-gray-700 hover:border-purple-600 transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedJob(job);
                      setShowJobDetails(true);
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="text-xl font-semibold text-white mb-2">
                          {job.title}
                        </h4>
                        <div className="flex items-center space-x-4 mb-3">
                          <span className="flex items-center text-gray-400 text-sm">
                            <Building className="w-4 h-4 mr-1" />
                            {job.company}
                          </span>
                          <span className="flex items-center text-gray-400 text-sm">
                            <MapPin className="w-4 h-4 mr-1" />
                            {job.location}
                          </span>
                          {job.salary && (
                            <span className="flex items-center text-green-400 text-sm">
                              <DollarSign className="w-4 h-4 mr-1" />
                              {job.salary}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-300 line-clamp-2 mb-3">
                          {job.description}
                        </p>
                        <div className="flex items-center space-x-4">
                          <span className="px-3 py-1 bg-purple-900/30 text-purple-400 rounded-lg text-xs">
                            {job.employmentType || 'Full-time'}
                          </span>
                          <span className="px-3 py-1 bg-blue-900/30 text-blue-400 rounded-lg text-xs">
                            {job.workplaceType || 'Onsite'}
                          </span>
                          <span className="flex items-center text-gray-500 text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            Posted {new Date(job.postedDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveJob(job);
                          }}
                          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Heart className="w-5 h-5 text-gray-400 hover:text-red-500" />
                        </button>
                        <a
                          href={job.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-5 h-5 text-gray-400 hover:text-purple-500" />
                        </a>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Job Details Modal */}
      {showJobDetails && selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setShowJobDetails(false)}
        />
      )}
    </div>
  );
}