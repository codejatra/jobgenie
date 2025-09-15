'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Link as LinkIcon,
  Trash2,
  Star,
  RefreshCw,
  Target,
  Briefcase,
  GraduationCap,
  TrendingUp,
  Clock,
  Copy,
  Edit3
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  uploadResume,
  getUserResumes,
  analyzeResumeContent,
  tailorResumeForJob,
  setDefaultResume,
  deleteResume,
  StoredResume,
  ResumeAnalysis
} from '@/lib/services/resumeService';
import toast from 'react-hot-toast';

export default function ResumeAnalyzerPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [tailoredResult, setTailoredResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'analyze' | 'tailor' | 'manage'>('upload');
  const [userResumes, setUserResumes] = useState<StoredResume[]>([]);
  const [selectedResume, setSelectedResume] = useState<StoredResume | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserResumes();
    }
  }, [user]);

  const loadUserResumes = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const resumes = await getUserResumes(user.uid);
      setUserResumes(resumes);

      // Set default resume if exists
      const defaultResume = resumes.find(r => r.isDefault);
      if (defaultResume) {
        setSelectedResume(defaultResume);
        setResumeText(defaultResume.extractedText || '');
        if (defaultResume.analysis) {
          setAnalysis(defaultResume.analysis);
        }
      }
    } catch (error) {
      console.error('Error loading resumes:', error);
      toast.error('Failed to load saved resumes');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      if (uploadedFile.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size must be less than 5MB');
        return;
      }
      setFile(uploadedFile);
    }
  };

  const handleUploadAndSave = async () => {
    if (!file || !user) {
      toast.error('Please select a file to upload');
      return;
    }

    setLoading(true);
    try {
      const uploaded = await uploadResume(user.uid, file);
      toast.success('Resume uploaded and saved successfully!');

      // Update state
      setUserResumes([uploaded, ...userResumes]);
      setSelectedResume(uploaded);
      setResumeText(uploaded.extractedText || '');
      setAnalysis(uploaded.analysis || null);
      setFile(null);

      // Switch to analyze tab
      setActiveTab('analyze');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload resume');
    } finally {
      setLoading(false);
    }
  };

  const analyzeResume = async () => {
    const textToAnalyze = selectedResume?.extractedText || resumeText;

    if (!textToAnalyze.trim()) {
      toast.error('Please provide resume content to analyze');
      return;
    }

    setAnalyzing(true);
    try {
      const analysisResult = await analyzeResumeContent(textToAnalyze);
      setAnalysis(analysisResult);
      toast.success('Resume analyzed successfully!');

      // Update stored resume with analysis if selected
      if (selectedResume) {
        // You can update Firestore here if needed
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze resume');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTailorResume = async () => {
    const textToTailor = selectedResume?.extractedText || resumeText;

    if (!textToTailor.trim()) {
      toast.error('Please provide resume content');
      return;
    }

    if (!jobDescription.trim() && !jobUrl.trim()) {
      toast.error('Please provide job description or URL');
      return;
    }

    setTailoring(true);
    try {
      // If job URL provided, you could fetch job details here
      const jobInfo = jobDescription || `Job at: ${jobUrl}`;

      const result = await tailorResumeForJob(textToTailor, jobInfo);
      setTailoredResult(result);
      toast.success('Resume tailored successfully!');
    } catch (error) {
      console.error('Tailoring error:', error);
      toast.error('Failed to tailor resume');
    } finally {
      setTailoring(false);
    }
  };

  const handleSetDefault = async (resume: StoredResume) => {
    if (!user) return;
    try {
      await setDefaultResume(user.uid, resume.id);
      toast.success('Default resume updated');
      loadUserResumes();
    } catch (error) {
      toast.error('Failed to set default resume');
    }
  };

  const handleDeleteResume = async (resume: StoredResume) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this resume?')) return;

    try {
      await deleteResume(user.uid, resume.id, resume.fileUrl);
      toast.success('Resume deleted');
      setUserResumes(userResumes.filter(r => r.id !== resume.id));

      if (selectedResume?.id === resume.id) {
        setSelectedResume(null);
        setResumeText('');
        setAnalysis(null);
      }
    } catch (error) {
      toast.error('Failed to delete resume');
    }
  };

  const downloadTailoredResume = () => {
    if (!tailoredResult) return;

    const blob = new Blob([tailoredResult.tailoredResume], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tailored-resume.txt';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Resume downloaded');
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gray-900/50 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-white">Resume Center</h1>
          <p className="text-gray-400 mt-2">Upload, analyze, and tailor your resume with AI</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex space-x-1 mb-8 bg-gray-800/50 rounded-lg p-1 max-w-2xl">
          {[
            { id: 'upload', label: 'Upload', icon: Upload },
            { id: 'manage', label: 'My Resumes', icon: FileText },
            { id: 'analyze', label: 'Analyze', icon: Sparkles },
            { id: 'tailor', label: 'Tailor for Job', icon: Target }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 ${activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Panel - Input */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700"
          >
            {/* Upload Tab */}
            {activeTab === 'upload' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white mb-4">Upload New Resume</h2>

                {/* File Upload */}
                <div>
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-purple-500 bg-purple-900/20' : 'border-gray-600 hover:border-gray-500'
                      }`}
                  >
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="resume-upload"
                    />
                    <label htmlFor="resume-upload" className="cursor-pointer">
                      {file ? (
                        <div className="space-y-2">
                          <FileText className="w-12 h-12 text-purple-400 mx-auto" />
                          <p className="text-white font-medium">{file.name}</p>
                          <p className="text-sm text-gray-400">
                            {(file.size / 1024).toFixed(1)} KB • Click to change
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                          <p className="text-white font-medium">Drop your resume here</p>
                          <p className="text-sm text-gray-400">
                            PDF, DOC, DOCX, or TXT (Max 5MB)
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Or paste text */}
                <div>
                  <p className="text-gray-400 text-center mb-3">— OR —</p>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Paste Resume Text
                  </label>
                  <textarea
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    placeholder="Paste your resume content here..."
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none h-48"
                  />
                </div>

                <motion.button
                  onClick={handleUploadAndSave}
                  disabled={(!file && !resumeText.trim()) || loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold flex items-center justify-center space-x-2 hover:shadow-xl hover:shadow-purple-500/25 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>Upload & Save Resume</span>
                    </>
                  )}
                </motion.button>
              </div>
            )}

            {/* Manage Resumes Tab */}
            {activeTab === 'manage' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white mb-4">Saved Resumes</h2>

                {loading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
                  </div>
                ) : userResumes.length > 0 ? (
                  <div className="space-y-3">
                    {userResumes.map((resume) => (
                      <div
                        key={resume.id}
                        className={`p-4 bg-gray-900/50 rounded-lg border ${selectedResume?.id === resume.id
                          ? 'border-purple-500'
                          : 'border-gray-700'
                          }`}
                      >
                        <div className="flex items-start justify-between">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => {
                              setSelectedResume(resume);
                              setResumeText(resume.extractedText || '');
                              setAnalysis(resume.analysis || null);
                            }}
                          >
                            <div className="flex items-center space-x-2">
                              <FileText className="w-5 h-5 text-purple-400" />
                              <span className="text-white font-medium">
                                {resume.fileName}
                              </span>
                              {resume.isDefault && (
                                <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-400 mt-1">
                              Uploaded {new Date(resume.uploadedAt).toLocaleDateString()}
                            </p>
                            {resume.analysis && (
                              <p className="text-sm text-purple-400 mt-1">
                                Score: {resume.analysis.score}/100
                              </p>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            {!resume.isDefault && (
                              <button
                                onClick={() => handleSetDefault(resume)}
                                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                                title="Set as default"
                              >
                                <Star className="w-4 h-4 text-gray-400" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteResume(resume)}
                              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                              title="Delete resume"
                            >
                              <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No saved resumes yet</p>
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="mt-4 text-purple-400 hover:text-purple-300"
                    >
                      Upload your first resume
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Analyze Tab */}
            {activeTab === 'analyze' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white mb-4">Resume Analysis</h2>

                {selectedResume ? (
                  <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-700">
                    <p className="text-purple-300 text-sm">Analyzing:</p>
                    <p className="text-white font-medium">{selectedResume.fileName}</p>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                    <p className="text-gray-400 text-sm">
                      No resume selected. Upload or select a resume first.
                    </p>
                  </div>
                )}

                <motion.button
                  onClick={analyzeResume}
                  disabled={(!selectedResume && !resumeText.trim()) || analyzing}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold flex items-center justify-center space-x-2 hover:shadow-xl hover:shadow-purple-500/25 transition-all disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Analyze Resume</span>
                    </>
                  )}
                </motion.button>
              </div>
            )}

            {/* Tailor Tab */}
            {activeTab === 'tailor' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white mb-4">Tailor for Job</h2>

                {selectedResume ? (
                  <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-700">
                    <p className="text-purple-300 text-sm">Using:</p>
                    <p className="text-white font-medium">{selectedResume.fileName}</p>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                    <p className="text-gray-400 text-sm">
                      No resume selected. Upload or select a resume first.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Job URL (Optional)
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="url"
                      value={jobUrl}
                      onChange={(e) => setJobUrl(e.target.value)}
                      placeholder="https://example.com/job-listing"
                      className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Job Description
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the job description here..."
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none h-32"
                  />
                </div>

                <motion.button
                  onClick={handleTailorResume}
                  disabled={(!selectedResume && !resumeText.trim()) || (!jobUrl && !jobDescription) || tailoring}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold flex items-center justify-center space-x-2 hover:shadow-xl hover:shadow-purple-500/25 transition-all disabled:opacity-50"
                >
                  {tailoring ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Tailoring...</span>
                    </>
                  ) : (
                    <>
                      <Target className="w-5 h-5" />
                      <span>Tailor Resume</span>
                    </>
                  )}
                </motion.button>
              </div>
            )}

          </motion.div>
        </div>

        {/* Right Panel - Results */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Analysis Results */}
          {analysis && activeTab === 'analyze' && (
            <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-6">Analysis Results</h2>

              {/* Score */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300">Overall Score</span>
                  <span className="text-2xl font-bold text-white">{analysis.score}/100</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${analysis.score}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-3 rounded-full ${analysis.score >= 80
                      ? 'bg-green-500'
                      : analysis.score >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                      }`}
                  />
                </div>
              </div>

              {/* Profile Summary */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="flex items-center text-gray-400 text-sm mb-1">
                    <Briefcase className="w-4 h-4 mr-1" />
                    Role
                  </div>
                  <p className="text-white font-medium">{analysis.role}</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="flex items-center text-gray-400 text-sm mb-1">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Seniority
                  </div>
                  <p className="text-white font-medium capitalize">{analysis.seniority}</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="flex items-center text-gray-400 text-sm mb-1">
                    <Clock className="w-4 h-4 mr-1" />
                    Experience
                  </div>
                  <p className="text-white font-medium">{analysis.experience}</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="flex items-center text-gray-400 text-sm mb-1">
                    <GraduationCap className="w-4 h-4 mr-1" />
                    Education
                  </div>
                  <p className="text-white font-medium">{analysis.education}</p>
                </div>
              </div>

              {/* Strengths */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                  Strengths
                </h3>
                <ul className="space-y-2">
                  {analysis.strengths.map((strength, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start text-gray-300"
                    >
                      <span className="text-green-500 mr-2">•</span>
                      {strength}
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Improvements */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <AlertCircle className="w-5 h-5 text-yellow-500 mr-2" />
                  Areas for Improvement
                </h3>
                <ul className="space-y-2">
                  {analysis.improvements.map((improvement, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start text-gray-300"
                    >
                      <span className="text-yellow-500 mr-2">•</span>
                      {improvement}
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Skills */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">Key Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.skills.map((skill, index) => (
                    <motion.span
                      key={index}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="px-3 py-1 bg-purple-900/30 text-purple-400 rounded-lg text-sm"
                    >
                      {skill}
                    </motion.span>
                  ))}
                </div>
              </div>

              {/* Keywords */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Recommended Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.keywords.map((keyword, index) => (
                    <motion.span
                      key={index}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="px-3 py-1 bg-blue-900/30 text-blue-400 rounded-lg text-sm"
                    >
                      {keyword}
                    </motion.span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tailored Resume Results */}
          {tailoredResult && activeTab === 'tailor' && (
            <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Tailored Resume</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(tailoredResult.tailoredResume);
                      toast.success('Copied to clipboard');
                    }}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={downloadTailoredResume}
                    className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Match Score */}
              <div className="mb-6 p-4 bg-purple-900/20 rounded-lg border border-purple-700">
                <div className="flex items-center justify-between">
                  <span className="text-purple-300">Job Match Score</span>
                  <span className="text-2xl font-bold text-white">
                    {tailoredResult.matchScore}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600"
                    style={{ width: `${tailoredResult.matchScore}%` }}
                  />
                </div>
              </div>

              {/* Changes Made */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">Changes Made</h3>
                <ul className="space-y-2">
                  {tailoredResult.changes.map((change: string, index: number) => (
                    <li key={index} className="flex items-start text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tailored Resume Content */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Resume Content</h3>
                <div className="bg-gray-900/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-gray-300 text-sm font-mono">
                    {tailoredResult.tailoredResume}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}