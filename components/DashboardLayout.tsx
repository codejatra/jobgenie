'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Search,
  Heart,
  FileText,
  User,
  CreditCard,
  LogOut,
  Menu,
  X,
  Briefcase,
  Home,
  Settings,
  Receipt
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/firebase/auth';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Job Search', href: '/dashboard', icon: Search },
    { name: 'Favorites', href: '/dashboard/favorites', icon: Heart },
    { name: 'Resume Analyzer', href: '/dashboard/resume', icon: FileText },
    { name: 'LinkedIn Optimizer', href: '/dashboard/linkedin', icon: Briefcase },
    { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
    { name: 'Purchase History', href: '/dashboard/purchases', icon: Receipt }, // Add this
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      toast.success('Signed out successfully');
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Mobile Sidebar Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Desktop and Mobile Sidebar Container */}
      <div className="flex h-screen">
        {/* Sidebar - Fixed on desktop, sliding on mobile */}
        <aside
          className={`
            fixed lg:relative
            top-0 left-0 z-50 lg:z-30
            h-full w-64
            bg-gray-900/95 backdrop-blur-md
            border-r border-gray-800
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0
          `}
        >
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <Link href="/dashboard" className="flex items-center space-x-2">
                <Sparkles className="w-8 h-8 text-purple-500" />
                <span className="text-xl font-bold text-white">JobGenie</span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* User Info */}
            <div className="px-6 py-4 border-b border-gray-800">
              <div className="flex items-center space-x-3">
                <img
                  src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName || user?.email}`}
                  alt="Profile"
                  className="w-10 h-10 rounded-full border-2 border-purple-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {profile?.displayName || user?.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-gray-400">
                    {profile?.credits || 0} credits
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navigation.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center space-x-3 px-3 py-2 rounded-lg
                      transition-all duration-200
                      ${isActive
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Sign Out Button */}
            <div className="p-4 border-t border-gray-800">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center space-x-3 px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col w-full lg:w-auto overflow-hidden">
          {/* Mobile Header */}
          <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-gray-900/50 backdrop-blur-md border-b border-gray-800">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-purple-500" />
              <span className="text-lg font-bold text-white">JobGenie</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Credits</p>
              <p className="text-sm font-semibold text-purple-400">{profile?.credits || 0}</p>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}