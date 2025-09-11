'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Lock, 
  Bell, 
  Globe, 
  Moon, 
  Save,
  Camera,
  AlertCircle,
  Check
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updatePassword, updateEmail, updateProfile } from 'firebase/auth';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'preferences'>('profile');
  
  // Profile settings
  const [displayName, setDisplayName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  
  // Account settings
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [jobAlerts, setJobAlerts] = useState(true);
  const [newsletter, setNewsletter] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
     
      setPhotoPreview(profile.photoURL || '');
    }
    if (user) {
      setEmail(user.email || '');
    }
  }, [profile, user]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let photoURL = profile?.photoURL;
      
      // Upload photo if changed
      if (photoFile) {
        const storageRef = ref(storage, `profiles/${user.uid}/avatar.jpg`);
        await uploadBytes(storageRef, photoFile);
        photoURL = await getDownloadURL(storageRef);
        
        // Update Firebase Auth profile
        await updateProfile(user, { photoURL });
      }
      
      // Update display name in Firebase Auth
      if (displayName !== profile?.displayName) {
        await updateProfile(user, { displayName });
      }
      
      // Update Firestore profile
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName,
        photoURL,
        updatedAt: new Date(),
      });
      
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountUpdate = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Update email if changed
      if (email !== user.email) {
        await updateEmail(user, email);
        toast.success('Email updated successfully!');
      }
      
      // Update password if provided
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          toast.error('Passwords do not match');
          return;
        }
        if (newPassword.length < 6) {
          toast.error('Password must be at least 6 characters');
          return;
        }
        await updatePassword(user, newPassword);
        toast.success('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error: any) {
      console.error('Account update error:', error);
      toast.error(error.message || 'Failed to update account');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesUpdate = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        preferences: {
          emailNotifications,
          jobAlerts,
          newsletter,
        },
        updatedAt: new Date(),
      });
      
      toast.success('Preferences updated successfully!');
    } catch (error: any) {
      console.error('Preferences update error:', error);
      toast.error('Failed to update preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gray-900/50 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-2">Manage your account and preferences</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex space-x-1 mb-8 bg-gray-800/50 rounded-lg p-1 max-w-md">
          {['profile', 'account', 'preferences'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all capitalize ${
                activeTab === tab
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="max-w-2xl">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700"
            >
              <h2 className="text-xl font-bold text-white mb-6">Profile Information</h2>
              
              {/* Avatar Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Profile Photo
                </label>
                <div className="flex items-center space-x-4">
                  <img
                    src={photoPreview || `https://ui-avatars.com/api/?name=${displayName || user?.email}`}
                    alt="Profile"
                    className="w-20 h-20 rounded-full border-2 border-purple-500"
                  />
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium cursor-pointer hover:bg-purple-700 transition-colors inline-flex items-center space-x-2"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Change Photo</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Display Name */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  placeholder="John Doe"
                />
              </div>

              

              <motion.button
                onClick={handleProfileUpdate}
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold flex items-center justify-center space-x-2 hover:shadow-xl hover:shadow-purple-500/25 transition-all disabled:opacity-50"
              >
                {loading ? 'Updating...' : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Save Profile</span>
                  </>
                )}
              </motion.button>
            </motion.div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700"
            >
              <h2 className="text-xl font-bold text-white mb-6">Account Settings</h2>
              
              {/* Email */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Password Change */}
              <div className="border-t border-gray-700 pt-6 mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Change Password</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                        placeholder="Enter new password"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <motion.button
                onClick={handleAccountUpdate}
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full mt-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold flex items-center justify-center space-x-2 hover:shadow-xl hover:shadow-purple-500/25 transition-all disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Account'}
              </motion.button>
            </motion.div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700"
            >
              <h2 className="text-xl font-bold text-white mb-6">Notification Preferences</h2>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg cursor-pointer hover:bg-gray-900/50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-white font-medium">Email Notifications</p>
                      <p className="text-sm text-gray-400">Receive important updates via email</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="w-5 h-5 text-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg cursor-pointer hover:bg-gray-900/50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Bell className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-white font-medium">Job Alerts</p>
                      <p className="text-sm text-gray-400">Get notified about new job matches</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={jobAlerts}
                    onChange={(e) => setJobAlerts(e.target.checked)}
                    className="w-5 h-5 text-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg cursor-pointer hover:bg-gray-900/50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Globe className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-white font-medium">Newsletter</p>
                      <p className="text-sm text-gray-400">Weekly career tips and insights</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={newsletter}
                    onChange={(e) => setNewsletter(e.target.checked)}
                    className="w-5 h-5 text-purple-600 rounded"
                  />
                </label>
              </div>

              <motion.button
                onClick={handlePreferencesUpdate}
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full mt-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold flex items-center justify-center space-x-2 hover:shadow-xl hover:shadow-purple-500/25 transition-all disabled:opacity-50"
              >
                {loading ? 'Saving...' : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Save Preferences</span>
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}