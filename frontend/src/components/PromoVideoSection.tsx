import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayCircleIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { analytics } from '../services/analytics';

interface PromoVideoSectionProps {
  ctaLink: string;
}

const PromoVideoSection: React.FC<PromoVideoSectionProps> = ({ ctaLink }) => {
  const videoUrl = process.env.REACT_APP_PROMO_VIDEO_URL || '/sovereign-demo.mp4';
  const posterUrl = process.env.REACT_APP_PROMO_VIDEO_POSTER || '/sovereign-demo-poster.jpg';
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadVideo, setLoadVideo] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [milestonesHit, setMilestonesHit] = useState<Set<number>>(new Set());

  const hasVideo = useMemo(() => !!videoUrl, [videoUrl]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const node = sectionRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            analytics.trackEvent('video_impression', {
              category: 'conversion',
              label: 'homepage_promo_video',
            });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const openVideo = () => {
    setLoadVideo(true);
    setIsModalOpen(true);
    analytics.trackEvent('video_play_click', {
      category: 'conversion',
      label: 'homepage_promo_video',
    });
  };

  const closeVideo = () => {
    setIsModalOpen(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || !videoRef.current.duration) return;
    const percentage = Math.floor((videoRef.current.currentTime / videoRef.current.duration) * 100);
    const checkpoints = [25, 50, 75, 100];

    checkpoints.forEach((checkpoint) => {
      if (percentage >= checkpoint && !milestonesHit.has(checkpoint)) {
        setMilestonesHit((prev) => new Set(prev).add(checkpoint));
        analytics.trackEvent(`video_${checkpoint}`, {
          category: 'conversion',
          label: 'homepage_promo_video',
          value: checkpoint,
        });
      }
    });
  };

  if (!hasVideo) return null;

  return (
    <section id="product-demo" ref={sectionRef} className="py-20 bg-white dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-sm font-semibold tracking-wide uppercase text-primary-600 dark:text-primary-400">
              Product Demo
            </p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              See a compliance audit in 60 seconds
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Watch a contract go from upload to a cited, severity-ranked risk report — audited privately on AMD Instinct GPUs.
            </p>

            <ul className="mt-6 space-y-3">
              {[
                'Upload a contract or policy and pick a framework',
                'Toggle between AMD-private and Fireworks-fast inference',
                'Get a cited risk report you can export',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <CheckIcon className="h-5 w-5 text-green-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={openVideo}
                className="inline-flex items-center rounded-lg bg-primary-600 px-5 py-3 text-white font-semibold hover:bg-primary-500 transition-colors"
              >
                <PlayCircleIcon className="h-5 w-5 mr-2" />
                Watch 60-sec demo
              </button>

              <Link
                to="/compliance"
                onClick={() =>
                  analytics.trackEvent('video_section_cta_click', {
                    category: 'conversion',
                    label: 'homepage_promo_video',
                  })
                }
                className="inline-flex items-center rounded-lg bg-gray-100 dark:bg-gray-800 px-5 py-3 text-gray-900 dark:text-white font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Try the audit
              </Link>
            </div>
          </div>

          <div>
            <button
              onClick={openVideo}
              className="group relative w-full overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg"
              aria-label="Play Sovereign promo video"
            >
              {!posterFailed ? (
                <img
                  src={posterUrl}
                  alt="Sovereign product demo preview"
                  className="w-full aspect-video object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={() => setPosterFailed(true)}
                />
              ) : (
                <div className="w-full aspect-video bg-gradient-to-br from-gray-950 via-primary-900 to-gray-900 flex items-center justify-center">
                  <p className="font-display text-white text-lg font-semibold">Sovereign — compliance audit demo</p>
                </div>
              )}

              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/35 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-white/90 group-hover:scale-105 transition-transform flex items-center justify-center shadow-lg">
                  <PlayCircleIcon className="h-10 w-10 text-primary-600" />
                </div>
              </div>
              <span className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/70 text-white text-xs font-semibold">
                1:00
              </span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={closeVideo}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={closeVideo}
                className="absolute -top-12 right-0 text-white hover:text-gray-300"
                aria-label="Close video modal"
              >
                <XMarkIcon className="h-8 w-8" />
              </button>

              {loadVideo && (
                <video
                  ref={videoRef}
                  className="w-full rounded-xl shadow-2xl"
                  controls
                  autoPlay
                  preload="metadata"
                  playsInline
                  poster={!posterFailed ? posterUrl : undefined}
                  onPlay={() =>
                    analytics.trackEvent('video_play', {
                      category: 'conversion',
                      label: 'homepage_promo_video',
                    })
                  }
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => {
                    analytics.trackEvent('video_complete', {
                      category: 'conversion',
                      label: 'homepage_promo_video',
                    });
                  }}
                >
                  <source src={videoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default PromoVideoSection;