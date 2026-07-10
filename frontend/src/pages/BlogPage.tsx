import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { blogPostsData } from './BlogPostPage';
import { usePageTitle } from '../hooks/usePageTitle';
import SEOHead from '../components/SEOHead';
import { apiClient } from '../services/api';

const BlogPage: React.FC = () => {
  usePageTitle('Blog', 'Insights, tips, and stories from the world of AI-powered content creation at Sovereign.');
  const blogPosts = blogPostsData;
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);

  const categories = ['All', 'Features', 'New Feature', 'Platform', 'Guide', 'SEO'];

  const filteredPosts = selectedCategory === 'All'
    ? blogPosts
    : blogPosts.filter(post => post.category === selectedCategory);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setIsSubscribing(true);
    try {
      await apiClient.post('/newsletter/subscribe/', { email: newsletterEmail });
      toast.success('Thanks for subscribing! You\'ll receive our latest updates.');
      setNewsletterEmail('');
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.success('You\'re already subscribed!');
        setNewsletterEmail('');
      } else {
        toast.error('Failed to subscribe. Please try again.');
      }
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900">
      <SEOHead
        title="Blog"
        description="Insights, tips, and stories from the world of AI-powered content creation at Sovereign."
        canonical="/blog"
        ogType="website"
      />
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16 sm:py-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Sovereign Blog
          </h1>
          <p className="mt-2 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Insights, tips, and stories from the world of AI-powered content creation
          </p>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-12 flex flex-wrap justify-center gap-2"
        >
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {category}
            </button>
          ))}
        </motion.div>

        {/* Blog Grid */}
        {filteredPosts.length === 0 ? (
          <div className="mx-auto mt-16 text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">No posts found in this category.</p>
            <button
              onClick={() => setSelectedCategory('All')}
              className="mt-4 text-primary-600 hover:text-primary-500 font-medium"
            >
              View all posts
            </button>
          </div>
        ) : (
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-12 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {filteredPosts.map((post, index) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="flex flex-col"
            >
              <div className="relative w-full">
                <img
                  src={post.image}
                  alt={post.title}
                  className="aspect-[16/9] w-full rounded-2xl bg-gray-100 object-cover sm:aspect-[2/1] lg:aspect-[3/2]"
                />
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10" />
              </div>
              <div className="max-w-xl">
                <div className="mt-8 flex items-center gap-x-4 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    {post.category}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {post.readTime}
                  </span>
                </div>
                <div className="group relative">
                  <h3 className="mt-3 text-lg font-semibold leading-6 text-gray-900 dark:text-white group-hover:text-primary-600">
                    <Link to={`/blog/${post.slug}`}>
                      <span className="absolute inset-0" />
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-5 line-clamp-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {post.excerpt}
                  </p>
                </div>
                <div className="relative mt-8 flex items-center gap-x-4">
                  <div className="text-sm leading-6">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      <span className="absolute inset-0" />
                      {post.author}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">{post.date}</p>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
        )}

        {/* Newsletter Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mx-auto mt-32 max-w-2xl"
        >
          <div className="rounded-2xl bg-primary-600 px-6 py-10 sm:px-10 sm:py-16 lg:px-12">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Stay Updated
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-primary-100">
                Get the latest AI writing tips and Sovereign updates delivered to your inbox.
              </p>
              <form onSubmit={handleNewsletterSubmit} className="mx-auto mt-10 flex max-w-md gap-x-4">
                <label htmlFor="email-address" className="sr-only">
                  Email address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="min-w-0 flex-auto rounded-md border-0 bg-white/10 px-3.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 placeholder:text-white/75 focus:ring-2 focus:ring-inset focus:ring-white sm:text-sm sm:leading-6"
                  placeholder="Enter your email"
                />
                <button
                  type="submit"
                  disabled={isSubscribing}
                  className="flex-none rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-primary-600 shadow-sm hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
                >
                  {isSubscribing ? 'Subscribing...' : 'Subscribe'}
                </button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default BlogPage;