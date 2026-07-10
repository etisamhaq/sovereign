import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { EnvelopeIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { usePageTitle } from '../hooks/usePageTitle';
import SEOHead from '../components/SEOHead';
import { apiClient } from '../services/api';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const ContactPage: React.FC = () => {
  usePageTitle('Contact', 'Get in touch with the Sovereign team. We\'d love to hear from you — send us a message and we\'ll respond within 24 hours.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactFormData>();

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      await apiClient.post('/contact/', data);
      toast.success('Message sent successfully! We\'ll get back to you soon.');
      reset();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: EnvelopeIcon,
      title: 'Email',
      details: 'sovereign.tech@gmail.com',
      link: 'mailto:sovereign.tech@gmail.com'
    },
    {
      icon: MapPinIcon,
      title: 'Office',
      details: 'Lahore, Pakistan',
      link: null
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-900">
      <SEOHead
        title="Contact"
        description="Get in touch with the Sovereign team. We'd love to hear from you — send us a message and we'll respond within 24 hours."
        canonical="/contact"
      />
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Get in Touch
          </h1>
          <p className="mt-2 text-lg leading-8 text-gray-600 dark:text-gray-300">
            We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </motion.div>

        <div className="mx-auto mt-16 max-w-xl sm:mt-20">
          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2"
          >
            {contactInfo.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="text-center"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
                  <item.icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">
                  {item.title}
                </h3>
                {item.link ? (
                  <a
                    href={item.link}
                    className="mt-2 text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400"
                  >
                    {item.details}
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    {item.details}
                  </p>
                )}
              </motion.div>
            ))}
          </motion.div>

          {/* Contact Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6"
          >
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                className="input mt-1"
                {...register('name', { required: 'Name is required' })}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                type="email"
                id="email"
                className="input mt-1"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Subject
              </label>
              <input
                type="text"
                id="subject"
                className="input mt-1"
                {...register('subject', { required: 'Subject is required' })}
              />
              {errors.subject && (
                <p className="mt-1 text-sm text-red-600">{errors.subject.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Message
              </label>
              <textarea
                id="message"
                rows={4}
                className="input mt-1"
                {...register('message', {
                  required: 'Message is required',
                  minLength: {
                    value: 10,
                    message: 'Message must be at least 10 characters'
                  }
                })}
              />
              {errors.message && (
                <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary w-full"
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </motion.form>

          {/* FAQ Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-16"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
              Frequently Asked Questions
            </h2>
            <dl className="space-y-8">
              <div>
                <dt className="text-base font-semibold text-gray-900 dark:text-white">
                  What is the response time for support inquiries?
                </dt>
                <dd className="mt-2 text-base text-gray-600 dark:text-gray-300">
                  We typically respond to all inquiries within 24 hours during business days.
                </dd>
              </div>
              <div>
                <dt className="text-base font-semibold text-gray-900 dark:text-white">
                  Do you offer live support?
                </dt>
                <dd className="mt-2 text-base text-gray-600 dark:text-gray-300">
                  Yes, email support is available for all users. Pro subscribers get priority support with responses within a few hours during business days.
                </dd>
              </div>
              <div>
                <dt className="text-base font-semibold text-gray-900 dark:text-white">
                  Can I schedule a demo?
                </dt>
                <dd className="mt-2 text-base text-gray-600 dark:text-gray-300">
                  Absolutely! Just mention in your message that you'd like to schedule a demo, and we'll set it up.
                </dd>
              </div>
            </dl>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;