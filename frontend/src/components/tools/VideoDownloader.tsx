import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '../../services/api';
import {
  VideoCameraIcon,
  ArrowDownTrayIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface VideoFormat {
  format_id: string;
  quality: string;
  ext: string;
  filesize?: number;
  filesize_approx?: number;
}

interface VideoInfo {
  platform: string;
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  view_count: number;
  description: string;
  formats: VideoFormat[];
  url: string;
  video_id: string;
  is_video?: boolean;
}

interface DownloadResult {
  success: boolean;
  file_id: string;
  file_name: string;
  file_size: number;
  title: string;
  duration: number;
  format: string;
  quality: string;
  download_url: string;
}

const VideoDownloader: React.FC = () => {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [selectedQuality, setSelectedQuality] = useState('best');
  const [selectedFormat, setSelectedFormat] = useState('mp4');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);
  const [embedInfo, setEmbedInfo] = useState<any>(null);

  const formatDuration = (seconds: number): string => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return mb > 0 ? `${mb.toFixed(1)} MB` : 'Unknown size';
  };

  const handleGetInfo = async () => {
    if (!url.trim()) {
      setError('Please enter a video URL');
      return;
    }

    setLoading(true);
    setError('');
    setVideoInfo(null);
    setDownloadResult(null);
    setEmbedInfo(null);

    try {
      const response: any = await apiClient.post('/tools/video-download/info/', { url });

      if (response.error) {
        setError(response.error);
      } else {
        setVideoInfo(response);
        // Set default quality based on available formats
        if (response.formats && response.formats.length > 0) {
          setSelectedQuality(response.formats[0].quality || 'best');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to get video information');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!videoInfo) return;

    setDownloading(true);
    setError('');
    setDownloadResult(null);

    try {
      const response: any = await apiClient.post('/tools/video-download/download/', {
        url: videoInfo.url,
        quality: selectedQuality,
        format: selectedFormat
      });

      if (response.success) {
        setDownloadResult(response);

        // Trigger download with authentication
        // Get the auth token
        const token = localStorage.getItem('access_token');
        const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
        // Remove the /api prefix from download_url if it exists
        const downloadPath = response.download_url.startsWith('/api/')
          ? response.download_url.substring(4)
          : response.download_url;

        // If we have a token, use fetch to download with auth header
        if (token) {
          try {
            const downloadResponse = await fetch(`${apiBaseUrl}${downloadPath}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (downloadResponse.ok) {
              const blob = await downloadResponse.blob();
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = response.file_name;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
            } else {
              console.error('Download failed:', downloadResponse.statusText);
            }
          } catch (error) {
            console.error('Download error:', error);
            // Fallback to direct download without auth
            const downloadUrl = `${apiBaseUrl}${downloadPath}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = response.file_name;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        } else {
          // No token, try direct download
          const downloadUrl = `${apiBaseUrl}${downloadPath}`;
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = response.file_name;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        setError(response.error || 'Download failed');
        // Try to get embed info as fallback
        handleGetEmbed();
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to download video';
      setError(errorMessage);
      // If download fails due to 403 or other errors, get embed info
      if (errorMessage.includes('403') || errorMessage.includes('failed')) {
        handleGetEmbed();
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleGetEmbed = async () => {
    if (!videoInfo) return;

    try {
      const response: any = await apiClient.post('/tools/video-download/embed/', {
        url: videoInfo.url
      });

      if (response.success) {
        setEmbedInfo(response);
      }
    } catch (err) {
      console.error('Failed to get embed info:', err);
    }
  };

  const isValidUrl = (url: string): boolean => {
    return url.includes('youtube.com') ||
           url.includes('youtu.be') ||
           url.includes('instagram.com') ||
           url.includes('instagr.am');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl">
            <VideoCameraIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Video Downloader
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Download videos from YouTube
            </p>
          </div>
        </div>
      </motion.div>

      {/* Legal Notice */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
      >
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Important:</strong> Only download videos you have permission to download.
            Respect copyright laws and content creators' rights. This tool is for personal use only.
          </div>
        </div>
      </motion.div>

      {/* URL Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card mb-6"
      >
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Video URL
        </label>
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="input flex-1"
            disabled={loading || downloading}
          />
          <button
            onClick={handleGetInfo}
            disabled={loading || downloading || !url.trim()}
            className="btn btn-primary"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Getting Info...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <InformationCircleIcon className="w-5 h-5" />
                Get Info
              </span>
            )}
          </button>
        </div>
        {url && !isValidUrl(url) && (
          <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
            Please enter a valid YouTube URL
          </p>
        )}
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <p className="text-red-700 dark:text-red-300">{error}</p>
          {error.includes('403') && (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400">
              <p className="font-semibold mb-2">This error usually occurs due to YouTube's download protection.</p>
              <p>Try one of these alternatives:</p>
              <ul className="list-disc ml-5 mt-1">
                <li>Use a different video or try again later</li>
                <li>Try downloading public domain or Creative Commons videos</li>
                <li>Consider using YouTube's embed feature instead</li>
              </ul>
            </div>
          )}
        </motion.div>
      )}

      {/* Video Info */}
      {videoInfo && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mb-6"
        >
          <div className="flex gap-6">
            {/* Thumbnail */}
            {videoInfo.thumbnail && (
              <div className="flex-shrink-0">
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  className="w-48 h-auto rounded-lg"
                />
              </div>
            )}

            {/* Video Details */}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {videoInfo.title}
              </h3>

              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Platform:</span>
                  <span className="capitalize">{videoInfo.platform}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Uploader:</span>
                  <span>{videoInfo.uploader}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-4 h-4" />
                  <span>{formatDuration(videoInfo.duration)}</span>
                </div>
                {videoInfo.view_count > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Views:</span>
                    <span>{videoInfo.view_count.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Download Options */}
              <div className="mt-4 flex gap-4">
                {/* Quality Selection */}
                {videoInfo.formats && videoInfo.formats.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Quality
                    </label>
                    <select
                      value={selectedQuality}
                      onChange={(e) => setSelectedQuality(e.target.value)}
                      className="input input-sm"
                      disabled={downloading}
                    >
                      <option value="best">Best Available</option>
                      {videoInfo.formats.map((format) => (
                        <option key={format.format_id} value={format.quality}>
                          {format.quality} {format.filesize && `(${formatFileSize(format.filesize)})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Format Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Format
                  </label>
                  <select
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="input input-sm"
                    disabled={downloading}
                  >
                    <option value="mp4">MP4 (Video)</option>
                    <option value="webm">WebM (Video)</option>
                    <option value="mp3">MP3 (Audio Only)</option>
                  </select>
                </div>
              </div>

              {/* Download Button */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="mt-4 btn btn-primary"
              >
                {downloading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Downloading...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    Download {selectedFormat.toUpperCase()}
                  </span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Embed Alternative */}
      {embedInfo && !downloadResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
        >
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Alternative: Embed Video
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                {embedInfo.message}
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Embed Code (Copy and paste into your website):
                  </label>
                  <textarea
                    readOnly
                    value={embedInfo.embed_code}
                    className="w-full p-2 text-xs font-mono bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded"
                    rows={3}
                    onClick={(e) => e.currentTarget.select()}
                  />
                </div>

                <div className="flex gap-2">
                  <a
                    href={embedInfo.watch_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Watch on {embedInfo.platform === 'youtube' ? 'YouTube' : 'Instagram'}
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(embedInfo.embed_code);
                      alert('Embed code copied to clipboard!');
                    }}
                    className="btn btn-sm bg-gray-600 text-white hover:bg-gray-700"
                  >
                    Copy Embed Code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Download Success */}
      {downloadResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
        >
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-green-900 dark:text-green-100">
                Download Ready!
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {downloadResult.file_name} ({formatFileSize(downloadResult.file_size)})
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Your download should start automatically. If not, check your browser's download settings.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Supported Platforms */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
      >
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Supported Platforms
        </h4>
        <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span>• YouTube</span>
          <span>• YouTube Shorts</span>
        </div>
      </motion.div>
    </div>
  );
};

export default VideoDownloader;