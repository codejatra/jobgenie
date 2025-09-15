'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  DollarSign, 
  Briefcase, 
  Calendar,
  ExternalLink,
  Heart,
  FileText,
  Building,
  CheckCircle,
  Brain,
  TrendingUp,
  MessageSquare,
  Users,
  Target,
  Award,
  Download,
  Copy,
  Sparkles
} from 'lucide-react';
import { EnhancedJobListing } from '@/lib/services/jobSearchEnhanced';
import { 
  generateInterviewQuestions, 
  generateSalaryNegotiation, 
  getCompanyDetails 
} from '@/lib/services/jobSearchEnhanced';
import { tailorResumeForJob } from '@/lib/services/resumeService';
import { useAuth } from '@/contexts/AuthContext';
import MotivationLetterGenerator from './MotivationLetterGenerator';
import toast from 'react-hot-toast';

interface EnhancedJobDetailsModalProps {
  job: EnhancedJobListing;
  onClose: () => void;
  userResume?: string;
}

export default function EnhancedJobDetailsModal({ 
  job, 
  onClose, 
  userResume 
}: EnhancedJobDetailsModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'requirements' | 'company' | 'interview' | 'salary' | 'resume'
  >('overview');
  const [showMotivationGenerator, setShowMotivationGenerator] = useState(false);
  const [interviewQuestions, setInterviewQuestions] = useState<string[]>([]);
  const [salaryStrategy, setSalaryStrategy] = useState<any>(null);
  const [companyDetails, setCompanyDetails] = useState<any>(null);
  const [tailoredResume, setTailoredResume] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Load interview questions
  const loadInterviewQuestions = async () => {
    if (interviewQuestions.length > 0) return;
    
    setLoading('interview');
    try {
      const questions = await generateInterviewQuestions(job);
      setInterviewQuestions(questions);
    } catch (error) {
      toast.error('Failed to generate interview questions');
    } finally {
      setLoading(null);
    }
  };

  // Load salary negotiation strategy
  const loadSalaryStrategy = async () => {
    if (salaryStrategy) return;
    
    setLoading('salary');
    try {
      const strategy = await generateSalaryNegotiation(job, userResume);
      setSalaryStrategy(strategy);
    } catch (error) {
      toast.error('Failed to generate salary strategy');
    } finally {
      setLoading(null);
    }
  };

  // Load company details
  const loadCompanyDetails = async () => {
    if (companyDetails) return;
    
    setLoading('company');
    try {
      const details = await getCompanyDetails(job.company);
      setCompanyDetails(details);
    } catch (error) {
      toast.error('Failed to load company details');
    } finally {
      setLoading(null);
    }
  };

  // Generate tailored resume
  const generateTailoredResume = async () => {
    if (!userResume) {
      toast.error('Please upload a resume first');
      return;
    }
    
    setLoading('resume');
    try {
      const result = await tailorResumeForJob(userResume, job.description);
      setTailoredResume(result);
      toast.success('Resume tailored successfully!');
    } catch (error) {
      toast.error('Failed to tailor resume');
    } finally {
      setLoading(null);
    }
  };

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'interview') loadInterviewQuestions();
    if (activeTab === 'salary') loadSalaryStrategy();
    if (activeTab === 'company') loadCompanyDetails();
  }, [activeTab]);

  const downloadTailoredResume = () => {
    if (!tailoredResume) return;
    
    const blob = new Blob([tailoredResume.tailoredResume], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tailored-resume-${job.company}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="w-full max-w-5xl max-h-[90vh] overflow-hidden bg-gray-900 rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Match Score */}
          <div className="relative bg-gradient-to-r from-purple-900 to-pink-900 p-6">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Match Score Badge */}
            {job.matchScore && (
              <div className="absolute top-4 left-4 px-3 py-1 bg-white/20 backdrop-blur rounded-full">
                <span className="text-white font-semibold flex items-center">
                  <Target className="w-4 h-4 mr-1" />
                  {job.matchScore}% Match
                </span>
              </div>
            )}

            <div className="mt-8">
              <h2 className="text-2xl font-bold text-white mb-2">{job.title}</h2>
              <div className="flex items-center space-x-4 text-white/80">
                <span className="flex items-center">
                  <Building className="w-4 h-4 mr-1" />
                  {job.company}
                </span>
                <span className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  {job.location}
                </span>
                {job.salary && (
                  <span className="flex items-center text-green-300">
                    <DollarSign className="w-4 h-4 mr-1" />
                    {job.salary}
                  </span>
                )}
              </div>

              {/* Match Reasons */}
              {job.matchReasons && job.matchReasons.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.matchReasons.map((reason, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-green-500/20 text-green-200 rounded-lg text-xs"
                    >
                      ✓ {reason}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 mt-4">
                <motion.a
                  href={job.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 bg-white text-purple-900 rounded-lg font-semibold flex items-center space-x-2 hover:bg-gray-100 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Apply Now</span>
                </motion.a>
                <motion.button
                  onClick={() => setShowMotivationGenerator(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center space-x-2 hover:bg-purple-700 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>Cover Letter</span>
                </motion.button>
              </div>
            </div>
          </div>

          {/* Enhanced Tabs */}
          <div className="flex overflow-x-auto border-b border-gray-800 bg-gray-900/50">
            {[
              { id: 'overview', label: 'Overview', icon: Briefcase },
              { id: 'requirements', label: 'Requirements', icon: CheckCircle },
              { id: 'company', label: 'Company', icon: Building },
              { id: 'interview', label: 'Interview Prep', icon: MessageSquare },
              { id: 'salary', label: 'Salary Negotiation', icon: TrendingUp },
              { id: 'resume', label: 'Tailor Resume', icon: FileText }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-6 font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-900/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="overflow-y-auto max-h-[50vh] p-6">
            <AnimatePresence mode="wait">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {/* Missing Skills Alert */}
                  {job.missingSkills && job.missingSkills.length > 0 && (
                    <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                      <h4 className="text-yellow-400 font-semibold mb-2 flex items-center">
                        <Brain className="w-5 h-5 mr-2" />
                        Skills to Develop
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {job.missingSkills.map((skill, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-yellow-900/30 text-yellow-300 rounded-lg text-sm"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Job Details Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <p className="text-gray-400 text-sm mb-1">Employment Type</p>
                      <p className="text-white font-medium">{job.employmentType || 'Full-time'}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <p className="text-gray-400 text-sm mb-1">Workplace Type</p>
                      <p className="text-white font-medium">{job.workplaceType || 'Onsite'}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <p className="text-gray-400 text-sm mb-1">Posted Date</p>
                      <p className="text-white font-medium">
                        {new Date(job.postedDate).toLocaleDateString()}
                      </p>
                    </div>
                    {job.applicationDeadline && (
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <p className="text-gray-400 text-sm mb-1">Application Deadline</p>
                        <p className="text-white font-medium">
                          {new Date(job.applicationDeadline).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Job Description</h3>
                    <div className="text-gray-300 space-y-2 whitespace-pre-wrap">
                      {job.description}
                    </div>
                  </div>

                  {/* Responsibilities */}
                  {job.responsibilities && job.responsibilities.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Key Responsibilities</h3>
                      <ul className="space-y-2">
                        {job.responsibilities.map((resp, index) => (
                          <motion.li
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start text-gray-300"
                          >
                            <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                            <span>{resp}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Requirements Tab */}
              {activeTab === 'requirements' && (
                <motion.div
                  key="requirements"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {job.requirements && job.requirements.length > 0 ? (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">Requirements</h3>
                      <ul className="space-y-3">
                        {job.requirements.map((req, index) => (
                          <motion.li
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start bg-gray-800/30 rounded-lg p-3"
                          >
                            <span className="text-purple-400 mr-3 font-semibold">
                              {index + 1}.
                            </span>
                            <span className="text-gray-300">{req}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-8">
                      No specific requirements listed for this position.
                    </p>
                  )}
                </motion.div>
              )}

              {/* Company Tab */}
              {activeTab === 'company' && (
                <motion.div
                  key="company"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {loading === 'company' ? (
                    <div className="text-center py-8">
                      <Sparkles className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
                      <p className="text-gray-400">Loading company details...</p>
                    </div>
                  ) : companyDetails ? (
                    <>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-3">Company Overview</h3>
                        <p className="text-gray-300">{companyDetails.overview}</p>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-white mb-3">Culture & Values</h3>
                        <p className="text-gray-300">{companyDetails.culture}</p>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-white mb-3">Benefits & Perks</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {companyDetails.benefits.map((benefit: string, index: number) => (
                            <div key={index} className="flex items-center text-gray-300">
                              <Award className="w-4 h-4 text-purple-400 mr-2" />
                              {benefit}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-white mb-3">Interview Process</h3>
                        <p className="text-gray-300">{companyDetails.interviewProcess}</p>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-white mb-3">Growth Opportunities</h3>
                        <p className="text-gray-300">{companyDetails.growthOpportunities}</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Building className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">Company information not available</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Interview Prep Tab */}
              {activeTab === 'interview' && (
                <motion.div
                  key="interview"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {loading === 'interview' ? (
                    <div className="text-center py-8">
                      <Sparkles className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
                      <p className="text-gray-400">Generating interview questions...</p>
                    </div>
                  ) : interviewQuestions.length > 0 ? (
                    <>
                      <div className="p-4 bg-purple-900/20 border border-purple-700 rounded-lg">
                        <h3 className="text-purple-300 font-semibold mb-2">
                          Likely Interview Questions
                        </h3>
                        <p className="text-gray-400 text-sm">
                          Practice these questions to prepare for your interview
                        </p>
                      </div>

                      <div className="space-y-4">
                        {interviewQuestions.map((question, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-gray-800/50 rounded-lg p-4"
                          >
                            <div className="flex items-start">
                              <span className="text-purple-400 font-semibold mr-3">
                                Q{index + 1}.
                              </span>
                              <p className="text-gray-300 flex-1">{question}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                        <h4 className="text-blue-300 font-semibold mb-2">Pro Tips</h4>
                        <ul className="space-y-1 text-sm text-gray-300">
                          <li>• Use the STAR method for behavioral questions</li>
                          <li>• Research the company thoroughly before the interview</li>
                          <li>• Prepare specific examples from your experience</li>
                          <li>• Have questions ready to ask the interviewer</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">No interview questions generated yet</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Salary Negotiation Tab */}
              {activeTab === 'salary' && (
                <motion.div
                  key="salary"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {loading === 'salary' ? (
                    <div className="text-center py-8">
                      <Sparkles className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
                      <p className="text-gray-400">Generating salary negotiation strategy...</p>
                    </div>
                  ) : salaryStrategy ? (
                    <>
                      <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                        <h3 className="text-green-300 font-semibold mb-2">Expected Range</h3>
                        <p className="text-2xl font-bold text-white">
                          {salaryStrategy.expectedRange}
                        </p>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-white mb-3">
                          Negotiation Strategy
                        </h3>
                        <p className="text-gray-300 whitespace-pre-wrap">
                          {salaryStrategy.strategy}
                        </p>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-white mb-3">
                          Key Talking Points
                        </h3>
                        <ul className="space-y-3">
                          {salaryStrategy.talkingPoints.map((point: string, index: number) => (
                            <motion.li
                              key={index}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="flex items-start bg-gray-800/50 rounded-lg p-3"
                            >
                              <TrendingUp className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-300">{point}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">No salary strategy generated yet</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Tailor Resume Tab */}
              {activeTab === 'resume' && (
                <motion.div
                  key="resume"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {!userResume ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 mb-4">No resume uploaded</p>
                      <p className="text-sm text-gray-500">
                        Please upload a resume in the Resume Center first
                      </p>
                    </div>
                  ) : (
                    <>
                      {!tailoredResume ? (
                        <div className="text-center py-8">
                          <p className="text-gray-300 mb-6">
                            Generate a tailored version of your resume optimized for this specific job
                          </p>
                          <motion.button
                            onClick={generateTailoredResume}
                            disabled={loading === 'resume'}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold flex items-center space-x-2 mx-auto hover:shadow-xl hover:shadow-purple-500/25 transition-all disabled:opacity-50"
                          >
                            {loading === 'resume' ? (
                              <>
                                <Sparkles className="w-5 h-5 animate-spin" />
                                <span>Tailoring...</span>
                              </>
                            ) : (
                              <>
                                <FileText className="w-5 h-5" />
                                <span>Tailor My Resume</span>
                              </>
                            )}
                          </motion.button>
                        </div>
                      ) : (
                        <>
                          {/* Match Score */}
                          <div className="p-4 bg-purple-900/20 border border-purple-700 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-purple-300">Resume Match Score</span>
                              <span className="text-2xl font-bold text-white">
                                {tailoredResume.matchScore}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600"
                                style={{ width: `${tailoredResume.matchScore}%` }}
                              />
                            </div>
                          </div>

                          {/* Changes Made */}
                          <div>
                            <h3 className="text-lg font-semibold text-white mb-3">
                              Optimizations Made
                            </h3>
                            <ul className="space-y-2">
                              {tailoredResume.changes.map((change: string, index: number) => (
                                <li key={index} className="flex items-start text-gray-300">
                                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                  {change}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Actions */}
                          <div className="flex space-x-3">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(tailoredResume.tailoredResume);
                                toast.success('Copied to clipboard');
                              }}
                              className="flex-1 py-2 bg-gray-700 text-white rounded-lg font-medium flex items-center justify-center space-x-2 hover:bg-gray-600 transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                              <span>Copy</span>
                            </button>
                            <button
                              onClick={downloadTailoredResume}
                              className="flex-1 py-2 bg-purple-600 text-white rounded-lg font-medium flex items-center justify-center space-x-2 hover:bg-purple-700 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              <span>Download</span>
                            </button>
                          </div>

                          {/* Preview */}
                          <div>
                            <h3 className="text-lg font-semibold text-white mb-3">Preview</h3>
                            <div className="bg-gray-900/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                              <pre className="whitespace-pre-wrap text-gray-300 text-sm">
                                {tailoredResume.tailoredResume.substring(0, 500)}...
                              </pre>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Motivation Letter Generator Modal */}
        {showMotivationGenerator && (
          <MotivationLetterGenerator
            job={job}
            onClose={() => setShowMotivationGenerator(false)}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}