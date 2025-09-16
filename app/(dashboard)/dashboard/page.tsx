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
  Calendar,
  FileText,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Target,
  Upload,
  CheckCircle
} from 'lucide-react';
import { deductCredits } from '@/lib/services/jobService';
import {
  analyzeSearchIntent,
  searchJobsFromResume,
  EnhancedJobListing,
  SearchRefinements,

} from '@/lib/services/jobSearchEnhanced';
import { getUserResumes, StoredResume } from '@/lib/services/resumeService';
import { saveFavoriteJob } from '@/lib/services/favoriteService';
import EnhancedJobDetailsModal from '@/components/EnhancedJobDetailsModal';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // Search states
  const [searchPrompt, setSearchPrompt] = useState('');
  const [searchMode, setSearchMode] = useState<'prompt' | 'resume'>('prompt');
  const [selectedResume, setSelectedResume] = useState<StoredResume | null>(null);
  const [userResumes, setUserResumes] = useState<StoredResume[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Results states
  const [jobs, setJobs] = useState<EnhancedJobListing[]>([]);
  const [selectedJob, setSelectedJob] = useState<EnhancedJobListing | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);

  // Refinement states
  const [refinements, setRefinements] = useState<SearchRefinements | null>(null);
  const [missingInfo, setMissingInfo] = useState<string[]>([]);
  const [showRefinementModal, setShowRefinementModal] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);



  // Load user resumes
  useEffect(() => {
    if (user) {
      loadUserResumes();
    }
  }, [user]);

  // Check for payment success
  useEffect(() => {
    const verifyPayment = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentStatus = urlParams.get('payment');

      if (paymentStatus === 'success' && user) {
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

        window.history.replaceState({}, '', '/dashboard');
      }
    };

    if (user) {
      verifyPayment();
    }
  }, [user]);

  const loadUserResumes = async () => {
    if (!user) return;
    try {
      const resumes = await getUserResumes(user.uid);
      setUserResumes(resumes);

      // Set default resume if exists
      const defaultResume = resumes.find(r => r.isDefault);
      if (defaultResume) {
        setSelectedResume(defaultResume);
      }
    } catch (error) {
      console.error('Error loading resumes:', error);
    }
  };

  const [analyzingIntent, setAnalyzingIntent] = useState(false); // Add this state


  const analyzeAndRefine = async () => {
    const input = searchMode === 'resume'
      ? selectedResume?.extractedText || ''
      : searchPrompt;

    if (!input) {
      toast.error('Please provide search input');
      return;
    }

    setAnalyzingIntent(true); // Start loading
    toast.loading('Analyzing your search intent...', { id: 'analyze' });

    try {
      const analysis = await analyzeSearchIntent(input, searchMode === 'resume');
      setRefinements(analysis.refinements);
      setMissingInfo(analysis.missingInfo);

      toast.dismiss('analyze');

      if (analysis.missingInfo.length > 0) {
        setShowRefinementModal(true);
      } else {
        handleSearch(analysis.refinements);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze search intent', { id: 'analyze' });
      handleSearch();
    } finally {
      setAnalyzingIntent(false); // Stop loading
    }
  };

  const handleSearch = async (customRefinements?: SearchRefinements) => {
    console.log('Starting job search...');

    if (!profile || profile.credits <= 0) {
      toast.error('Insufficient credits. Please purchase more credits.');
      router.push('/dashboard/billing');
      return;
    }

    setIsSearching(true);
    setShowRefinementModal(false);

    try {
      // Deduct credit
      const creditDeducted = await deductCredits(user!.uid);
      if (!creditDeducted) {
        toast.error('Failed to process search. Please try again.');
        return;
      }

      let results: EnhancedJobListing[] = [];

      if (searchMode === 'resume' && selectedResume) {
        // Search using resume
        toast.loading('Analyzing resume and searching for matching jobs...', { id: 'search' });
        results = await searchJobsFromResume(selectedResume, customRefinements);
      } else {
        // Search using prompt with refinements
        toast.loading('Searching for jobs...', { id: 'search' });

        // Import the function directly from the already imported module
        const { searchWithRefinements } = await import('@/lib/services/jobSearchEnhanced');
        const searchQuery = buildSearchQuery(customRefinements || refinements || {});
        const finalRefinements = customRefinements || refinements || {
          jobTitles: [],
          synonyms: [],
          location: { remote: true },
          seniority: 'mid',
          mustHaveSkills: [],
          niceToHaveSkills: [],
          salary: {},
          contractType: 'full-time',
          eligibility: { languages: ['English'] },
          dateRange: 7,
          exclusions: {},
          targetCompanies: []
        };

        results = await searchWithRefinements(searchQuery, finalRefinements);
      }

      setJobs(results);
      setCurrentPage(1);
      console.log('Search completed, found jobs:', results.length);

      toast.success(`Found ${results.length} matching opportunities!`, { id: 'search' });
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Please try again.', { id: 'search' });
    } finally {
      setIsSearching(false);
    }
  };
  const buildSearchQuery = (refinements: Partial<SearchRefinements>) => {
    const parts = [searchPrompt];
    if (refinements.location?.city) parts.push(refinements.location.city);
    if (refinements.seniority) parts.push(refinements.seniority);
    return parts.join(' ');
  };

  const handleSaveJob = async (job: EnhancedJobListing) => {
    try {
      await saveFavoriteJob(user!.uid, job);
      toast.success('Job saved to favorites!');
    } catch (error) {
      toast.error('Failed to save job');
    }
  };

  // Pagination


  // Fix the pagination display
const jobsPerPage = 10;
const indexOfLastJob = currentPage * jobsPerPage;
const indexOfFirstJob = indexOfLastJob - jobsPerPage;
const currentJobs = jobs.slice(indexOfFirstJob, indexOfLastJob);
const totalPages = Math.ceil(jobs.length / jobsPerPage);


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

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-900/50 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Sparkles className="w-8 h-8 text-purple-500" />
              <h1 className="text-2xl font-bold text-white">JobGenie</h1>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Credits remaining</p>
              <p className="text-xl font-semibold text-purple-400">{profile?.credits || 0}</p>
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
            Find Your Perfect Job
          </h2>
          <p className="text-gray-400 text-center mb-8">
            Search with AI-powered matching using prompts or your resume
          </p>

          {/* Search Mode Toggle */}
          <div className="flex justify-center mb-6">
            <div className="bg-gray-800/50 rounded-lg p-1 inline-flex">
              <button
                onClick={() => setSearchMode('prompt')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${searchMode === 'prompt'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                <Search className="w-4 h-4 inline mr-2" />
                Search by Prompt
              </button>
              <button
                onClick={() => setSearchMode('resume')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${searchMode === 'resume'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Search by Resume
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-8 border border-gray-700">
            {searchMode === 'prompt' ? (
              <div className="space-y-4">
                <textarea
                  value={searchPrompt}
                  onChange={(e) => setSearchPrompt(e.target.value)}
                  placeholder="Example: Senior React Developer in San Francisco, $150k+, remote-friendly startup..."
                  className="w-full px-6 py-4 bg-gray-900/50 text-white rounded-xl border border-gray-700 focus:border-purple-500 focus:outline-none resize-none h-32 placeholder-gray-500"
                />

                {/* Smart Suggestions */}
                <div className="flex items-start space-x-2 text-sm text-gray-400">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <p>
                    Tip: Include job title, location, experience level, salary expectations, and preferred company type for best results
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {userResumes.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Select Resume for Job Matching
                    </label>
                    <div className="grid gap-3">
                      {userResumes.map((resume) => (
                        <div
                          key={resume.id}
                          onClick={() => setSelectedResume(resume)}
                          className={`p-4 bg-gray-900/50 rounded-lg border cursor-pointer transition-all ${selectedResume?.id === resume.id
                            ? 'border-purple-500 bg-purple-900/20'
                            : 'border-gray-700 hover:border-gray-600'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <FileText className="w-5 h-5 text-purple-400" />
                              <div>
                                <p className="text-white font-medium">{resume.fileName}</p>
                                <p className="text-sm text-gray-400">
                                  Score: {resume.analysis?.score || 'N/A'}/100
                                </p>
                              </div>
                            </div>
                            {selectedResume?.id === resume.id && (
                              <CheckCircle className="w-5 h-5 text-purple-400" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Upload className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 mb-4">No resumes uploaded yet</p>
                    <button
                      onClick={() => router.push('/dashboard/resume')}
                      className="text-purple-400 hover:text-purple-300 font-medium"
                    >
                      Upload Resume →
                    </button>
                  </div>
                )}
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={analyzeAndRefine}
              disabled={isSearching || analyzingIntent || (searchMode === 'prompt' ? !searchPrompt : !selectedResume)}
              className="mt-6 w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold flex items-center justify-center space-x-2 hover:shadow-2xl hover:shadow-purple-500/25 transition-all disabled:opacity-50"
            >
              {analyzingIntent ? (
                <>
                  <Sparkles className="w-5 h-5 animate-spin" />
                  <span>Analyzing Intent...</span>
                </>
              ) : isSearching ? (
                <>
                  <Sparkles className="w-5 h-5 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>Find Matching Jobs</span>
                </>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Refinement Modal */}
        {showRefinementModal && (
          <RefinementModal
            refinements={refinements}
            missingInfo={missingInfo}
            onConfirm={(updatedRefinements) => handleSearch(updatedRefinements)}
            onCancel={() => setShowRefinementModal(false)}
          />
        )}

        {/* Job Results */}
        <AnimatePresence>
          {jobs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-12"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">
                  Matched Opportunities ({jobs.length})
                </h3>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 bg-gray-800 text-white rounded-lg disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-gray-400">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 bg-gray-800 text-white rounded-lg disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid gap-4">
                {currentJobs.map((job, index) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.01 }}
                    className="bg-gray-800/50 backdrop-blur-md rounded-xl p-6 border border-gray-700 hover:border-purple-600 transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedJob(job);
                      setShowJobDetails(true);
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-xl font-semibold text-white">
                            {job.title}
                          </h4>
                          {job.matchScore && (
                            <span className="px-3 py-1 bg-purple-900/30 text-purple-400 rounded-full text-sm font-medium flex items-center">
                              <Target className="w-3 h-3 mr-1" />
                              {job.matchScore}% Match
                            </span>
                          )}
                        </div>

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

                        {/* Match Reasons */}
                        {job.matchReasons && job.matchReasons.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {job.matchReasons.slice(0, 3).map((reason, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-green-900/20 text-green-400 rounded text-xs"
                              >
                                ✓ {reason}
                              </span>
                            ))}
                          </div>
                        )}

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

      {/* Enhanced Job Details Modal */}
      {showJobDetails && selectedJob && (
        <EnhancedJobDetailsModal
          job={selectedJob}
          onClose={() => setShowJobDetails(false)}
          userResume={selectedResume?.extractedText}
        />
      )}
    </div>
  );
}

function RefinementModal({
  refinements,
  missingInfo,
  onConfirm,
  onCancel
}: {
  refinements: SearchRefinements | null;
  missingInfo: string[];
  onConfirm: (refinements: SearchRefinements) => void;
  onCancel: () => void;
}) {
  const [localRefinements, setLocalRefinements] = useState<SearchRefinements>(
    refinements || {
      jobTitles: [],
      synonyms: [],
      location: {},
      seniority: 'mid',
      mustHaveSkills: [],
      niceToHaveSkills: [],
      salary: {},
      contractType: 'full-time',
      eligibility: {},
      dateRange: 3,
      exclusions: {},
      targetCompanies: []
    }
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-gray-900 rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
      >
        <h3 className="text-xl font-bold text-white mb-4">Refine Your Search</h3>

        {missingInfo.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
            <p className="text-yellow-300 text-sm">Missing information:</p>
            <ul className="mt-2 space-y-1">
              {missingInfo.map((info, idx) => (
                <li key={idx} className="text-yellow-200 text-sm">• {info}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4">
          {/* Job Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Job Title
            </label>
            <input
              type="text"
              value={localRefinements.jobTitles.join(', ')}
              onChange={(e) => setLocalRefinements({
                ...localRefinements,
                jobTitles: e.target.value.split(',').map(t => t.trim()).filter(t => t)
              })}
              placeholder="e.g., Software Engineer, Developer"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Location
            </label>
            <input
              type="text"
              value={localRefinements.location.city || ''}
              onChange={(e) => setLocalRefinements({
                ...localRefinements,
                location: { ...localRefinements.location, city: e.target.value }
              })}
              placeholder="e.g., San Francisco, Remote"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
          </div>

          {/* Seniority */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Experience Level
            </label>
            <select
              value={localRefinements.seniority || 'mid'}
              onChange={(e) => setLocalRefinements({
                ...localRefinements,
                seniority: e.target.value
              })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              <option value="intern">Intern</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid-Level</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead</option>
            </select>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Required Skills
            </label>
            <input
              type="text"
              value={localRefinements.mustHaveSkills.join(', ')}
              onChange={(e) => setLocalRefinements({
                ...localRefinements,
                mustHaveSkills: e.target.value.split(',').map(s => s.trim()).filter(s => s)
              })}
              placeholder="e.g., React, Node.js, TypeScript"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
          </div>

          {/* Salary Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Min Salary ($)
              </label>
              <input
                type="number"
                value={localRefinements.salary.min || ''}
                onChange={(e) => setLocalRefinements({
                  ...localRefinements,
                  salary: { ...localRefinements.salary, min: parseInt(e.target.value) || 0 }
                })}
                placeholder="80000"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Salary ($)
              </label>
              <input
                type="number"
                value={localRefinements.salary.max || ''}
                onChange={(e) => setLocalRefinements({
                  ...localRefinements,
                  salary: { ...localRefinements.salary, max: parseInt(e.target.value) || 0 }
                })}
                placeholder="150000"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              />
            </div>
          </div>

          {/* Contract Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contract Type
            </label>
            <select
              value={localRefinements.contractType || 'full-time'}
              onChange={(e) => setLocalRefinements({
                ...localRefinements,
                contractType: e.target.value
              })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="freelance">Freelance</option>
            </select>
          </div>

          {/* Remote Options */}
          <div className="flex space-x-4">
            <label className="flex items-center text-gray-300">
              <input
                type="checkbox"
                checked={localRefinements.location.remote || false}
                onChange={(e) => setLocalRefinements({
                  ...localRefinements,
                  location: { ...localRefinements.location, remote: e.target.checked }
                })}
                className="mr-2"
              />
              Remote OK
            </label>
            <label className="flex items-center text-gray-300">
              <input
                type="checkbox"
                checked={localRefinements.location.hybrid || false}
                onChange={(e) => setLocalRefinements({
                  ...localRefinements,
                  location: { ...localRefinements.location, hybrid: e.target.checked }
                })}
                className="mr-2"
              />
              Hybrid OK
            </label>
          </div>
        </div>

        {/* ACTION BUTTONS - THIS WAS MISSING */}
        <div className="flex space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(localRefinements)}
            className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
          >
            Search with These Settings
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}