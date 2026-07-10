import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <motion.div
          className="inline-flex h-16 w-16 items-center justify-center rounded-xl bg-primary-600 text-white"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <ShieldCheckIcon className="h-9 w-9" />
        </motion.div>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;