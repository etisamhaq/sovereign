import React from 'react';
import { motion } from 'framer-motion';
import { usePageTitle } from '../hooks/usePageTitle';

const PrivacyPage: React.FC = () => {
  usePageTitle('Privacy Policy');
  const sections = [
    {
      title: 'Information We Collect',
      content: [
        'Account information (name, email address, password)',
        'Usage data (tools used, content created, timestamps)',
        'Device and browser information for analytics',
        'Payment information (processed securely through our payment provider)'
      ]
    },
    {
      title: 'How We Use Your Information',
      content: [
        'To provide and maintain our services',
        'To improve and personalize your experience',
        'To communicate with you about updates and offers',
        'To ensure the security of our platform',
        'To comply with legal obligations'
      ]
    },
    {
      title: 'Data Security',
      content: [
        'We use industry-standard encryption to protect your data',
        'All data transmissions are secured with SSL/TLS',
        'Regular security audits and updates',
        'Limited access to personal information by authorized personnel only'
      ]
    },
    {
      title: 'Your Rights',
      content: [
        'Access your personal data at any time',
        'Request correction of inaccurate information',
        'Delete your account and associated data',
        'Export your data in a portable format',
        'Opt-out of marketing communications'
      ]
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-6 lg:px-8 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Last updated: 6 February 2026
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="prose prose-lg dark:prose-invert max-w-none"
        >
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            At Sovereign, we take your privacy seriously. This Privacy Policy explains how we collect,
            use, disclose, and safeguard your information when you use our platform. Please read this
            privacy policy carefully. If you do not agree with the terms of this privacy policy,
            please do not access the site.
          </p>

          {sections.map((section, index) => (
            <motion.section
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="mb-12"
            >
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {section.title}
              </h2>
              <ul className="space-y-2">
                {section.content.map((item, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    <span className="text-gray-600 dark:text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.section>
          ))}

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mb-12"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Content Ownership
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              You retain all rights to the content you create using Sovereign. We do not claim ownership
              of any content generated through our platform. Your content is yours, and we will never:
            </p>
            <ul className="space-y-2 mb-4">
              <li className="flex items-start">
                <span className="text-primary-600 mr-2">•</span>
                <span className="text-gray-600 dark:text-gray-300">
                  Use your content for training our AI models without explicit consent
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-600 mr-2">•</span>
                <span className="text-gray-600 dark:text-gray-300">
                  Share or sell your content to third parties
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-600 mr-2">•</span>
                <span className="text-gray-600 dark:text-gray-300">
                  Access your content except for providing support or troubleshooting
                </span>
              </li>
            </ul>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mb-12"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Cookies and Tracking
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              We use cookies and similar tracking technologies to track activity on our platform and
              hold certain information. You can instruct your browser to refuse all cookies or to
              indicate when a cookie is being sent.
            </p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mb-12"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Third-Party Services
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              We may employ third-party companies and individuals to facilitate our Service:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start">
                <span className="text-primary-600 mr-2">•</span>
                <span className="text-gray-600 dark:text-gray-300">
                  Payment processors (Polar) for secure transactions
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-600 mr-2">•</span>
                <span className="text-gray-600 dark:text-gray-300">
                  Analytics providers to improve our services
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-600 mr-2">•</span>
                <span className="text-gray-600 dark:text-gray-300">
                  Cloud hosting services for data storage
                </span>
              </li>
            </ul>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="mb-12"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Contact Us
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              If you have any questions about this Privacy Policy, please contact us:
            </p>
            <ul className="mt-4 space-y-2">
              <li className="text-gray-600 dark:text-gray-300">
                Email: sovereign.tech@gmail.com
              </li>
              <li className="text-gray-600 dark:text-gray-300">
                Address: Lahore, Pakistan
              </li>
            </ul>
          </motion.section>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="mt-12 p-6 bg-primary-50 dark:bg-primary-900/20 rounded-lg"
          >
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <strong>Note:</strong> We reserve the right to update this privacy policy at any time.
              We will notify you of any changes by posting the new privacy policy on this page and
              updating the "Last updated" date.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default PrivacyPage;