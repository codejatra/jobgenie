'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MapPin, Building, DollarSign, Calendar, ExternalLink, Trash2, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeFavorites, removeFavoriteJob, FavoriteJob } from '@/lib/services/favoriteService';
import JobDetailsModal from '@/components/JobDetailsModal';
import toast from 'react-hot-toast';

export default function FavoritesPage() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<FavoriteJob | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const unsubscribe = subscribeFavorites(user.uid, (favs) => {
      setFavorites(favs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleRemoveFavorite = async (favorite: FavoriteJob) => {
    try {
      if (!favorite.favoriteId) {
        toast.error('Cannot remove this favorite');
        return;
      }
      await removeFavoriteJob(favorite.favoriteId);
      toast.success('Removed from favorites');
    } catch (error) {
      console.error('Remove favorite error:', error);
      toast.error('Failed to remove from favorites');
    }
  };

  const filteredFavorites = favorites.filter(job =>
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gray-900/50 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-white">Saved Jobs</h1>
          <p className="text-gray-400 mt-2">Your favorite job opportunities</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search saved jobs..."
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Favorites Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Heart className="w-12 h-12 text-purple-500" />
            </motion.div>
          </div>
        ) : filteredFavorites.length > 0 ? (
          <div className="grid gap-4">
            <AnimatePresence>
              {filteredFavorites.map((job, index) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
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
                      <h3 className="text-xl font-semibold text-white mb-2">
                        {job.title}
                      </h3>
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span className="px-3 py-1 bg-purple-900/30 text-purple-400 rounded-lg text-xs">
                            {job.employmentType || 'Full-time'}
                          </span>
                          <span className="flex items-center text-gray-500 text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            Saved {new Date(job.savedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFavorite(job); // Pass the whole job object
                        }}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors group"
                      >
                        <Trash2 className="w-5 h-5 text-gray-400 group-hover:text-red-500" />
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
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-20">
            <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No saved jobs yet</h3>
            <p className="text-gray-400">
              Start searching and save jobs you're interested in
            </p>
          </div>
        )}
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