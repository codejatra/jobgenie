'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  MapPin, 
  DollarSign, 
  Briefcase, 
  Clock, 
  Calendar,
  ExternalLink,
  Heart,
  FileText,
  Building,
  Users,
  Globe,
  Mail,
  Phone,
  CheckCircle
} from 'lucide-react';
import { JobListing } from '@/lib/services/jobService';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import MotivationLetterGenerator from './MotivationLetterGenerator';
import toast from 'react-hot-toast';

interface JobDetailsModalProps {
  job: JobListing;
  onClose: () => void;
}

export default function JobDetailsModal({ job, onClose }: JobDetailsModalProps) {
  const { user } = useAuth();
  const [showMotivationGenerator, setShowMotivationGenerator] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'requirements' | 'company'>('overview');

  const handleSaveJob = async () => {
    try {
      const { saveFavoriteJob } = await import('@/lib/services/favoriteService');
      await saveFavoriteJob(user!.uid, job);
      toast.success('Job saved to favorites!');
    } catch (error) {
      toast.error('Failed to save job');
    }
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
          className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-gray-900 rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-purple-900 to-pink-900 p-6">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

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
                  {job.salary} {job.currency}
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-4">
              <motion.a
                href={job.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-2 bg-white text-purple-900 rounded-lg font-semibold flex items-center space-x-2 hover:bg-gray-100 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Apply Now</span>
              </motion.a>
              <motion.button
                onClick={handleSaveJob}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-white/20 text-white rounded-lg flex items-center space-x-2 hover:bg-white/30 transition-colors"
              >
                <Heart className="w-4 h-4" />
                <span>Save</span>
              </motion.button>
              <motion.button
                onClick={() => setShowMotivationGenerator(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center space-x-2 hover:bg-purple-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>Generate Cover Letter</span>
              </motion.button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            {['overview', 'requirements', 'company'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-3 px-6 capitalize font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-purple-400 border-b-2 border-purple-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[50vh] p-6">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {/* Job Details */}
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

              {activeTab === 'company' && (
                <motion.div
                  key="company"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {job.companyInfo ? (
                    <>
                      {job.companyInfo.about && (
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-3">About {job.company}</h3>
                          <p className="text-gray-300">{job.companyInfo.about}</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        {job.companyInfo.size && (
                          <div className="bg-gray-800/50 rounded-lg p-4">
                            <Users className="w-5 h-5 text-purple-400 mb-2" />
                            <p className="text-gray-400 text-sm">Company Size</p>
                            <p className="text-white font-medium">{job.companyInfo.size}</p>
                          </div>
                        )}
                        {job.companyInfo.industry && (
                          <div className="bg-gray-800/50 rounded-lg p-4">
                            <Briefcase className="w-5 h-5 text-purple-400 mb-2" />
                            <p className="text-gray-400 text-sm">Industry</p>
                            <p className="text-white font-medium">{job.companyInfo.industry}</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Building className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">
                        Company information not available for this listing.
                      </p>
                    </div>
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