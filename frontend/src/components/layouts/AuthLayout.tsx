import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheckIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Auth form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-8">
              <Link to="/" className="inline-flex items-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white">
                  <ShieldCheckIcon className="h-6 w-6" />
                </span>
                <span className="ml-2 font-display text-2xl font-bold text-gray-900 dark:text-white">
                  Sovereign
                </span>
              </Link>
            </div>
            <Outlet />
          </motion.div>
        </div>
      </div>

      {/* Right side - brand panel */}
      <div className="hidden lg:block lg:flex-1 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-primary-900 to-gray-900">
          {/* faint grid */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="max-w-md text-white">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-400/30 bg-primary-500/10 px-4 py-1.5">
                <LockClosedIcon className="h-4 w-4 text-primary-300" />
                <span className="text-sm font-medium text-primary-200">Runs on your own AMD GPUs</span>
              </div>
              <h2 className="font-display text-4xl font-bold leading-tight">
                Audit compliance without leaking your data
              </h2>
              <p className="mt-4 text-lg text-gray-300">
                Check contracts and policies against GDPR, HIPAA, and SOC 2 — privately, on your own
                infrastructure. Confidential documents never reach a third-party API.
              </p>
              <div className="mt-8 flex space-x-10">
                <div>
                  <div className="font-display text-3xl font-bold">3</div>
                  <div className="text-sm text-gray-400">Frameworks</div>
                </div>
                <div>
                  <div className="font-display text-3xl font-bold">Zero</div>
                  <div className="text-sm text-gray-400">Data shared</div>
                </div>
                <div>
                  <div className="font-display text-3xl font-bold">3</div>
                  <div className="text-sm text-gray-400">Providers, one toggle</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
