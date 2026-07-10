import React from 'react';
import { motion } from 'framer-motion';
import { usePageTitle } from '../hooks/usePageTitle';

interface SubSection {
  subtitle?: string;
  content?: string;
  items?: string[];
}

interface Section {
  title: string;
  content?: string;
  subsections?: SubSection[];
}

const TermsPage: React.FC = () => {
  usePageTitle('Terms of Service');
  const sections: Section[] = [
    {
      title: '1. Acceptance of Terms',
      content: `By accessing and using Sovereign, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.`
    },
    {
      title: '2. Description of Service',
      content: `Sovereign provides AI-powered writing and content creation tools. The service includes access to various text generation, editing, and optimization features. We reserve the right to modify, suspend, or discontinue any aspect of the service at any time.`
    },
    {
      title: '3. User Accounts',
      content: `You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account. You must be at least 13 years old to use this service.`
    },
    {
      title: '4. Acceptable Use',
      subsections: [
        {
          subtitle: 'You agree NOT to use Sovereign to:',
          items: [
            'Generate content that is illegal, harmful, or offensive',
            'Create spam, phishing content, or malware',
            'Violate intellectual property rights',
            'Impersonate others or create misleading content',
            'Attempt to reverse engineer or hack our systems',
            'Use automated systems to access the service beyond normal usage'
          ]
        }
      ]
    },
    {
      title: '5. Content Ownership and License',
      content: `You retain ownership of all content you create using Sovereign. By using our service, you grant us a limited license to process and display your content solely for the purpose of providing the service. We do not claim ownership of your content.`
    },
    {
      title: '6. Payment Terms',
      subsections: [
        {
          subtitle: 'Subscription Plans:',
          items: [
            'Free Plan: Limited to 50 uses per month',
            'Pro Plan: $5/month for unlimited access',
            'Payments are processed securely through our payment partners',
            'Subscriptions auto-renew unless cancelled',
            'Refunds are available within 7 days of payment'
          ]
        }
      ]
    },
    {
      title: '7. Intellectual Property',
      content: `The Sovereign platform, including its design, features, and content (excluding user-generated content), is owned by Sovereign and protected by copyright, trademark, and other intellectual property laws.`
    },
    {
      title: '8. Privacy',
      content: `Your use of Sovereign is also governed by our Privacy Policy. Please review our Privacy Policy, which also governs the Site and informs users of our data collection practices.`
    },
    {
      title: '9. Disclaimers and Limitations',
      subsections: [
        {
          subtitle: 'Service Warranty:',
          content: `Sovereign is provided "as is" without warranties of any kind. We do not guarantee that the service will be uninterrupted, error-free, or completely secure.`
        },
        {
          subtitle: 'Content Accuracy:',
          content: `AI-generated content may contain errors or inaccuracies. Users are responsible for reviewing and verifying all content before use.`
        },
        {
          subtitle: 'Liability Limitation:',
          content: `In no event shall Sovereign be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.`
        }
      ]
    },
    {
      title: '10. Indemnification',
      content: `You agree to indemnify and hold harmless Sovereign and its officers, directors, employees, and agents from any claims, damages, or expenses arising from your use of the service or violation of these terms.`
    },
    {
      title: '11. Termination',
      content: `We reserve the right to terminate or suspend your account at any time for violations of these terms. You may cancel your account at any time through your account settings.`
    },
    {
      title: '12. Governing Law',
      content: `These Terms shall be governed by and construed in accordance with the laws of Pakistan. Any disputes shall be subject to the exclusive jurisdiction of the courts in Lahore, Pakistan.`
    },
    {
      title: '13. Changes to Terms',
      content: `We reserve the right to modify these terms at any time. We will notify users of any material changes via email or through the platform. Continued use of the service after changes constitutes acceptance of the new terms.`
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
            Terms of Service
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
            Welcome to Sovereign! These Terms of Service ("Terms") govern your use of our website
            and services. By using Sovereign, you agree to these Terms. Please read them carefully.
          </p>

          {sections.map((section, index) => (
            <motion.section
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              className="mb-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {section.title}
              </h2>

              {section.content && (
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {section.content}
                </p>
              )}

              {section.subsections && section.subsections.map((subsection, subIdx) => (
                <div key={subIdx} className="mb-4">
                  {subsection.subtitle && (
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {subsection.subtitle}
                    </h3>
                  )}
                  {subsection.content && (
                    <p className="text-gray-600 dark:text-gray-300 mb-2">
                      {subsection.content}
                    </p>
                  )}
                  {subsection.items && (
                    <ul className="space-y-2 ml-4">
                      {subsection.items.map((item: string, itemIdx: number) => (
                        <li key={itemIdx} className="flex items-start">
                          <span className="text-primary-600 mr-2">•</span>
                          <span className="text-gray-600 dark:text-gray-300">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </motion.section>
          ))}

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mb-12"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Contact Information
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              If you have any questions about these Terms, please contact us:
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
            transition={{ delay: 1.0 }}
            className="mt-12 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <strong>Important:</strong> By using Sovereign, you acknowledge that you have read,
              understood, and agree to be bound by these Terms of Service. If you do not agree
              with any part of these terms, you must not use our service.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default TermsPage;