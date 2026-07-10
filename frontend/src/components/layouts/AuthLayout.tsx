import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

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
                <img
                  src="/logo.jpg"
                  alt="Sovereign"
                  className="w-12 h-12 rounded-lg"
                />
                <span className="ml-2 text-2xl font-bold text-gray-900 dark:text-white">
                  Sovereign
                </span>
              </Link>
            </div>
            <Outlet />
          </motion.div>
        </div>
      </div>

      {/* Right side - Background image/pattern */}
      <div className="hidden lg:block lg:flex-1 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-700">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="text-white text-center">
              <h2 className="text-4xl font-bold mb-4">
                Transform Your Writing with AI
              </h2>
              <p className="text-xl opacity-90 max-w-md">
                Access powerful AI tools to enhance your writing, improve grammar,
                and create compelling content effortlessly.
              </p>
              <div className="mt-8 flex justify-center space-x-8">
                <div className="text-center">
                  <div className="text-3xl font-bold">33+</div>
                  <div className="text-sm opacity-75">AI Tools</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">20+</div>
                  <div className="text-sm opacity-75">Languages</div>
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