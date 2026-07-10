import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  getCategories,
  createPost,
  uploadPostAttachment,
  CreatePostData,
} from '../../services/community';
import { useAuthStore } from '../../store/authStore';
import {
  ArrowLeftIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  TagIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const MAX_IMAGES = 4;
const MAX_VIDEOS = 1;
const MAX_ATTACHMENTS = 6;

type PendingMedia = { file: File; kind: 'image' | 'video'; previewUrl: string };

const NewPostPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [mediaItems, setMediaItems] = useState<PendingMedia[]>([]);

  const { data: categories } = useQuery({
    queryKey: ['community-categories'],
    queryFn: getCategories,
  });

  const submitLockRef = useRef(false);

  const mutation = useMutation({
    mutationFn: async (payload: {
      post: CreatePostData;
      media: PendingMedia[];
    }) => {
      const created = await createPost(payload.post);
      if (!created.slug) {
        throw new Error('Server did not return a post slug. Update the backend or try again.');
      }
      for (let i = 0; i < payload.media.length; i++) {
        const fd = new FormData();
        fd.append('file', payload.media[i].file);
        fd.append('kind', payload.media[i].kind);
        fd.append('sort_order', String(i));
        await uploadPostAttachment(created.slug, fd);
      }
      return created;
    },
    onSuccess: (data) => {
      if (data.moderation_state === 'pending') {
        toast.success('Post submitted — it will appear after review.');
      } else {
        toast.success('Post published!');
      }
      mediaItems.forEach((m) => URL.revokeObjectURL(m.previewUrl));
      queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      queryClient.invalidateQueries({ queryKey: ['community-stats'] });
      queryClient.invalidateQueries({ queryKey: ['my-community-posts'] });
      navigate(`/community/post/${data.slug}`);
    },
    onError: (error: any) => {
      if (error?.message && !error?.response) {
        toast.error(String(error.message));
        return;
      }
      const msg = error?.response?.data;
      if (typeof msg === 'object') {
        const firstError = Object.values(msg).flat()[0];
        toast.error(String(firstError) || 'Failed to create post');
      } else {
        toast.error('Failed to create post');
      }
    },
  });

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    const next = [...mediaItems];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_ATTACHMENTS) {
        toast.error(`Maximum ${MAX_ATTACHMENTS} attachments`);
        break;
      }
      const isVid = file.type.startsWith('video/');
      const isImg = file.type.startsWith('image/');
      if (!isVid && !isImg) {
        toast.error('Only images and videos are allowed');
        continue;
      }
      const kind = isVid ? 'video' : 'image';
      const videosNow = next.filter((x) => x.kind === 'video').length;
      const imagesNow = next.filter((x) => x.kind === 'image').length;
      if (kind === 'video' && videosNow >= MAX_VIDEOS) {
        toast.error('Only one video per post');
        continue;
      }
      if (kind === 'image' && imagesNow >= MAX_IMAGES) {
        toast.error(`Up to ${MAX_IMAGES} images per post`);
        continue;
      }
      next.push({
        file,
        kind,
        previewUrl: URL.createObjectURL(file),
      });
    }
    setMediaItems(next);
    e.target.value = '';
  };

  const removeMediaAt = (index: number) => {
    setMediaItems((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || mutation.isPending) return;
    if (!title.trim() || !content.trim() || !categoryId) {
      toast.error('Please fill in all required fields');
      return;
    }
    submitLockRef.current = true;
    mutation.mutate(
      {
        post: {
          title: title.trim(),
          content: content.trim(),
          category_id: categoryId,
          tags,
        },
        media: mediaItems,
      },
      {
        onSettled: () => {
          submitLockRef.current = false;
        },
      }
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Sign in to create a post
          </h2>
          <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Go to Login →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/community"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to Community
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Create New Post
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories?.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      categoryId === cat.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's your post about?"
                maxLength={300}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-400">{title.length}/300</p>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your post content here... Share your thoughts, ask a question, or start a discussion."
                rows={10}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
              />
              <p className="mt-1 text-xs text-gray-400">{content.length} characters</p>
            </div>

            {/* Media */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Images & video{' '}
                <span className="text-xs text-gray-400 font-normal">
                  (optional — up to {MAX_IMAGES} images, {MAX_VIDEOS} video)
                </span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={mediaItems.length >= MAX_ATTACHMENTS}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50 transition-colors w-full sm:w-auto"
              >
                <PhotoIcon className="h-5 w-5" />
                Add photos or video
              </button>
              {mediaItems.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {mediaItems.map((m, i) => (
                    <div
                      key={`${m.previewUrl}-${i}`}
                      className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-900"
                    >
                      {m.kind === 'image' ? (
                        <img
                          src={m.previewUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={m.previewUrl}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMediaAt(i)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                        aria-label="Remove"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                      <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                        {m.kind}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags <span className="text-xs text-gray-400">(optional, max 5)</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
                    }}
                    placeholder="Add a tag..."
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={tags.length >= 5}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim() || tags.length >= 5}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Link
                to="/community"
                className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={mutation.isPending || !title.trim() || !content.trim() || !categoryId}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                {mutation.isPending ? 'Posting...' : 'Publish Post'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default NewPostPage;
