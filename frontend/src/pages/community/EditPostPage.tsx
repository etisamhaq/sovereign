import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { getCategories, getPost, updatePost } from '../../services/community';
import { useAuthStore } from '../../store/authStore';
import {
  ArrowLeftIcon,
  PaperAirplaneIcon,
  TagIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const EditPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ['community-post', slug],
    queryFn: () => getPost(slug!),
    enabled: !!slug,
  });

  const { data: categories } = useQuery({
    queryKey: ['community-categories'],
    queryFn: getCategories,
  });

  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setContent(post.content);
      setCategoryId(post.category.id);
      setTags(post.tags || []);
    }
  }, [post]);

  const mutation = useMutation({
    mutationFn: (data: { title: string; content: string; category_id: string; tags: string[] }) =>
      updatePost(slug!, data),
    onSuccess: () => {
      toast.success('Post updated!');
      navigate(`/community/post/${slug}`);
    },
    onError: () => toast.error('Failed to update post'),
  });

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !categoryId) {
      toast.error('Please fill in all required fields');
      return;
    }
    mutation.mutate({ title: title.trim(), content: content.trim(), category_id: categoryId, tags });
  };

  if (postLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (post && user?.id !== post.author.id) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Not authorized</h2>
          <Link to="/community" className="text-primary-600">← Back to Community</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to={`/community/post/${slug}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 mb-6 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to Post
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Edit Post</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories?.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      categoryId === cat.id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                    placeholder="Add a tag..."
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={tags.length >= 5}
                  />
                </div>
                <button type="button" onClick={handleAddTag} disabled={!tagInput.trim() || tags.length >= 5}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50">
                  Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                      #{tag}
                      <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-red-500">
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Link to={`/community/post/${slug}`} className="px-5 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                {mutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default EditPostPage;
