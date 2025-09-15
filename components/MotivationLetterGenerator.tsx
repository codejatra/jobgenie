'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, RefreshCw, Download, Copy, Check, Sparkles } from 'lucide-react';
import { JobListing } from '@/lib/services/jobService';
import { GoogleGenerativeAI } from '@google/generative-ai';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

interface MotivationLetterGeneratorProps {
  job: JobListing;
  onClose: () => void;
}

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

export default function MotivationLetterGenerator({ job, onClose }: MotivationLetterGeneratorProps) {
  const { profile } = useAuth();
  const [letter, setLetter] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userInfo, setUserInfo] = useState({
    name: profile?.displayName || '',
    experience: '',
    skills: '',
    achievements: '',
  });
  const [step, setStep] = useState<'input' | 'preview'>('input');

  const generateLetter = async () => {
    setLoading(true);

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `
        Generate a professional and compelling motivation/cover letter for the following job:
        
        Job Title: ${job.title}
        Company: ${job.company}
        Job Description: ${job.description}
        Requirements: ${job.requirements?.join(', ')}
        
        Applicant Information:
        Name: ${userInfo.name}
        Experience: ${userInfo.experience}
        Key Skills: ${userInfo.skills}
        Notable Achievements: ${userInfo.achievements}
        
        Please write a personalized, engaging cover letter that:
        1. Shows enthusiasm for the role and company
        2. Highlights relevant experience and skills
        3. Demonstrates understanding of the job requirements
        4. Includes specific examples and achievements
        5. Maintains a professional yet personable tone
        6. Is concise (around 300-400 words)
        
        Format the letter properly with date, salutation, body paragraphs, and closing.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const generatedLetter = response.text();

      setLetter(generatedLetter);
      setStep('preview');
      toast.success('Cover letter generated successfully!');
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate cover letter. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const regenerateLetter = async () => {
    await generateLetter();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(letter);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadLetter = () => {
    const blob = new Blob([letter], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cover-letter-${job.company}-${job.title}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Cover letter downloaded!');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl max-h-[85vh] bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-900 to-pink-900 p-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="w-6 h-6 text-white" />
              <h2 className="text-xl font-bold text-white">Motivation Letter Generator</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-88px)]">
            {step === 'input' ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div>
                  <p className="text-gray-300 mb-4">
                    Provide some information about yourself to generate a personalized cover letter for:
                  </p>
                  <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                    <p className="text-purple-400 font-semibold">{job.title}</p>
                    <p className="text-gray-400">{job.company}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      value={userInfo.name}
                      onChange={(e) => setUserInfo({ ...userInfo, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Relevant Experience *
                    </label>
                    <textarea
                      value={userInfo.experience}
                      onChange={(e) => setUserInfo({ ...userInfo, experience: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none h-24"
                      placeholder="e.g., 3 years as a Flutter Developer at TechCorp, led mobile app development..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Key Skills *
                    </label>
                    <textarea
                      value={userInfo.skills}
                      onChange={(e) => setUserInfo({ ...userInfo, skills: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none h-20"
                      placeholder="e.g., Flutter, Dart, Firebase, REST APIs, State Management..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Notable Achievements
                    </label>
                    <textarea
                      value={userInfo.achievements}
                      onChange={(e) => setUserInfo({ ...userInfo, achievements: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none h-20"
                      placeholder="e.g., Increased app performance by 40%, Published 2 apps with 100k+ downloads..."
                    />
                  </div>
                </div>

                <motion.button
                  onClick={generateLetter}
                  disabled={!userInfo.name || !userInfo.experience || !userInfo.skills || loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold flex items-center justify-center space-x-2 hover:shadow-xl hover:shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="w-5 h-5" />
                      </motion.div>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Generate Cover Letter</span>
                    </>
                  )}
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Your Cover Letter</h3>
                  <div className="flex space-x-2">
                    <motion.button
                      onClick={regenerateLetter}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-4 py-2 bg-gray-800 text-white rounded-lg flex items-center space-x-2 hover:bg-gray-700 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Regenerate</span>
                    </motion.button>
                    <motion.button
                      onClick={copyToClipboard}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-4 py-2 bg-gray-800 text-white rounded-lg flex items-center space-x-2 hover:bg-gray-700 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </motion.button>
                    <motion.button
                      onClick={downloadLetter}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center space-x-2 hover:bg-purple-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </motion.button>
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                  <pre className="whitespace-pre-wrap text-gray-300 font-sans">
                    {letter}
                  </pre>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setStep('input')}
                    className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
                  >
                    Back to Edit
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-xl hover:shadow-purple-500/25 transition-all"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}