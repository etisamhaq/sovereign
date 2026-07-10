import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SparklesIcon, LightBulbIcon, UserGroupIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';
import { usePageTitle } from '../hooks/usePageTitle';
import SEOHead from '../components/SEOHead';

const AboutPage: React.FC = () => {
  usePageTitle('About');
  const values = [
    {
      icon: SparklesIcon,
      title: 'Innovation',
      description: 'We leverage cutting-edge AI technology to revolutionize content creation and make it accessible to everyone.'
    },
    {
      icon: UserGroupIcon,
      title: 'Community',
      description: 'Building a supportive community of writers, students, and professionals who help each other succeed.'
    },
    {
      icon: LightBulbIcon,
      title: 'Simplicity',
      description: 'Complex technology made simple. Our tools are designed to be intuitive and easy to use.'
    },
    {
      icon: RocketLaunchIcon,
      title: 'Growth',
      description: 'We\'re committed to continuous improvement and helping our users achieve their content goals.'
    }
  ];

  const team = [
    {
      name: 'Etisam Ul Haq',
      role: 'Founder & Software Developer',
      image: null,
      bio: 'Passionate about building AI-powered tools that make content creation accessible to everyone.'
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-900">
      <SEOHead
        title="About Sovereign"
        description="Learn about Sovereign — the AI-powered platform with 33+ tools for writing, research, education, and productivity. Our mission, team, and values."
        canonical="/about"
      />
      {/* Hero Section */}
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-2xl py-16 sm:py-24 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
              About Sovereign
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              We're on a mission to make AI-powered content creation accessible to everyone.
              From students to professionals, bloggers to businesses, Sovereign provides the tools
              you need to create amazing content in minutes, not hours.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Mission Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mx-auto max-w-7xl px-6 lg:px-8 py-16"
      >
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-primary-600">Our Mission</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Empowering Content Creators Worldwide
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            We believe that everyone has a story to tell and ideas worth sharing. Our platform
            removes the barriers to content creation by providing powerful AI tools that help
            you write better, faster, and more efficiently.
          </p>
        </div>
      </motion.div>

      {/* Values Section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mx-auto max-w-2xl lg:text-center mb-16"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Our Values
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            The principles that guide everything we do
          </p>
        </motion.div>

        <div className="mx-auto max-w-2xl lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="flex flex-col"
              >
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900 dark:text-white">
                  <value.icon className="h-5 w-5 flex-none text-primary-600" aria-hidden="true" />
                  {value.title}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-300">
                  <p className="flex-auto">{value.description}</p>
                </dd>
              </motion.div>
            ))}
          </dl>
        </div>
      </div>

      {/* Team Section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mx-auto max-w-2xl lg:text-center mb-16"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Meet Our Team
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            The talented people behind Sovereign
          </p>
        </motion.div>

        <ul className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-1 lg:mx-0 lg:max-w-none lg:grid-cols-1 justify-items-center">
          {team.map((person, index) => (
            <motion.li
              key={person.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="text-center max-w-sm"
            >
              <div className="aspect-square w-32 mx-auto rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <span className="text-4xl font-bold text-white">
                  {person.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <h3 className="mt-6 text-lg font-semibold leading-8 text-gray-900 dark:text-white">{person.name}</h3>
              <p className="text-base leading-7 text-primary-600">{person.role}</p>
              <p className="mt-4 text-base leading-7 text-gray-600 dark:text-gray-300">{person.bio}</p>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mx-auto max-w-7xl px-6 lg:px-8 py-16"
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Ready to Transform Your Content Creation?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-600 dark:text-gray-300">
            Join our growing community of creators who use Sovereign to produce amazing content.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              to="/register"
              className="rounded-md bg-primary-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              Get started for free
            </Link>
            <Link to="/features" className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">
              Learn more <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AboutPage;