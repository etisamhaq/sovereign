import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../../services/api';
import {
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  SparklesIcon,
  ClockIcon,
  LanguageIcon,
  PlayIcon,
  ArrowRightIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface VideoInfo {
  video_id: string;
  title: string;
  description: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  view_count: number;
  platform: string;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Transcript {
  text: string;
  segments: Array<{ text: string; index: number }>;
  word_count: number;
  language: string;
}

const VideoChat: React.FC = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'transcript' | 'summary'>('chat');
  const [error, setError] = useState('');

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

  const handleAnalyzeVideo = async () => {
    if (!videoUrl.trim()) {
      setError('Please enter a video URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get video info first
      const infoResponse: any = await apiClient.post('/tools/video-download/info/', {
        url: videoUrl
      });

      if (infoResponse.error) {
        setError(infoResponse.error);
        setLoading(false);
        return;
      }

      setVideoInfo(infoResponse);

      // Generate initial summary
      await generateSummary('brief');

      // Add welcome message
      const welcomeMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `I've analyzed the video "${infoResponse.title}". Feel free to ask me any questions about the content, or switch to the Transcript or Summary tabs for more details.`,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);

    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to analyze video');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentQuestion.trim() || !videoUrl) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentQuestion,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentQuestion('');
    setLoading(true);

    try {
      const response: any = await apiClient.post('/tools/video-chat/chat/', {
        url: videoUrl,
        question: currentQuestion
      });

      if (response.success) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: response.answer,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        setError(response.error || 'Failed to get response');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process question');
    } finally {
      setLoading(false);
    }
  };

  const generateTranscript = async () => {
    if (!videoUrl) return;

    setLoading(true);
    setError('');

    try {
      const response: any = await apiClient.post('/tools/video-chat/transcript/', {
        url: videoUrl,
        format: 'segments'
      });

      if (response.success) {
        setTranscript({
          text: response.transcript || '',
          segments: response.segments || [],
          word_count: response.word_count || 0,
          language: response.language || 'en'
        });
      } else {
        setError(response.error || 'Failed to generate transcript');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate transcript');
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async (type: string = 'detailed') => {
    if (!videoUrl) return;

    setLoading(true);
    setError('');

    try {
      const response: any = await apiClient.post('/tools/video-chat/summary/', {
        url: videoUrl,
        summary_type: type
      });

      if (response.success) {
        setSummary(response.summary);
      } else {
        setError(response.error || 'Failed to generate summary');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate summary');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = async (tab: 'chat' | 'transcript' | 'summary') => {
    setActiveTab(tab);
    
    // Generate content if not already available
    if (tab === 'transcript' && !transcript && videoInfo) {
      await generateTranscript();
    } else if (tab === 'summary' && !summary && videoInfo) {
      await generateSummary('detailed');
    }
  };

  const suggestedQuestions = [
    "What are the main topics discussed in this video?",
    "Can you provide a brief summary of the key points?",
    "What are the most important takeaways?",
    "Are there any actionable insights mentioned?",
    "What examples or case studies are discussed?"
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
            <ChatBubbleLeftRightIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Video Chat AI
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Have intelligent conversations about any video content
            </p>
          </div>
        </div>
      </motion.div>

      {/* URL Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card mb-6"
      >
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Video URL (YouTube, Vimeo, Dailymotion)
        </label>
        <div className="flex gap-3">
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="input flex-1"
            disabled={loading}
          />
          <button
            onClick={handleAnalyzeVideo}
            disabled={loading || !videoUrl.trim()}
            className="btn btn-primary"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analyzing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <PlayIcon className="w-5 h-5" />
                Analyze Video
              </span>
            )}
          </button>
        </div>
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Video Info */}
      {videoInfo && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mb-6"
        >
          <div className="flex gap-4">
            {videoInfo.thumbnail && (
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="w-32 h-20 object-cover rounded-lg"
              />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {videoInfo.title}
              </h3>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <VideoCameraIcon className="w-4 h-4" />
                  {videoInfo.uploader}
                </span>
                <span className="flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  {formatDuration(videoInfo.duration)}
                </span>
                {videoInfo.view_count > 0 && (
                  <span>{videoInfo.view_count.toLocaleString()} views</span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Content Area */}
      {videoInfo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => handleTabChange('chat')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'chat'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="w-5 h-5" />
                Chat
              </span>
            </button>
            <button
              onClick={() => handleTabChange('transcript')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'transcript'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5" />
                Transcript
              </span>
            </button>
            <button
              onClick={() => handleTabChange('summary')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'summary'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5" />
                Summary
              </span>
            </button>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {/* Chat Tab */}
            {activeTab === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Messages */}
                <div className="h-96 overflow-y-auto space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  {messages.length === 0 ? (
                    <div className="text-center py-8">
                      <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <p className="text-gray-600 dark:text-gray-400">
                        Start a conversation about the video
                      </p>
                      
                      {/* Suggested Questions */}
                      <div className="mt-6 space-y-2">
                        <p className="text-sm text-gray-500 dark:text-gray-500 mb-3">
                          Suggested questions:
                        </p>
                        {suggestedQuestions.map((question, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentQuestion(question)}
                            className="block w-full text-left px-3 py-2 text-sm bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${
                          message.type === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-3xl px-4 py-3 rounded-lg ${
                            message.type === 'user'
                              ? 'bg-primary-600 text-white'
                              : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs mt-1 opacity-70">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                  
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white dark:bg-gray-700 px-4 py-3 rounded-lg">
                        <div className="flex gap-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={currentQuestion}
                    onChange={(e) => setCurrentQuestion(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask a question about the video..."
                    className="input flex-1"
                    disabled={loading}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={loading || !currentQuestion.trim()}
                    className="btn btn-primary"
                  >
                    <ArrowRightIcon className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Transcript Tab */}
            {activeTab === 'transcript' && (
              <motion.div
                key="transcript"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                {loading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">Generating transcript...</p>
                  </div>
                ) : transcript ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>{transcript.word_count} words</span>
                        <span className="flex items-center gap-1">
                          <LanguageIcon className="w-4 h-4" />
                          {transcript.language.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      {transcript.segments.length > 0 ? (
                        <div className="space-y-3">
                          {transcript.segments.map((segment, index) => (
                            <div key={index} className="pb-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
                              <p className="text-gray-900 dark:text-white">
                                {segment.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                          {transcript.text}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <DocumentTextIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Transcript will be generated when you switch to this tab
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                {loading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">Generating summary...</p>
                  </div>
                ) : summary ? (
                  <div className="space-y-4">
                    <div className="flex gap-2 mb-4">
                      {['brief', 'detailed', 'bullet', 'academic'].map((type) => (
                        <button
                          key={type}
                          onClick={() => generateSummary(type)}
                          className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 capitalize"
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    
                    <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                        {summary}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <SparklesIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Summary will be generated when you switch to this tab
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Features */}
      {!videoInfo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8"
        >
          <div className="card">
            <ChatBubbleLeftRightIcon className="w-8 h-8 text-primary-600 mb-3" />
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Interactive Q&A
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ask any question about the video content and get intelligent answers
            </p>
          </div>
          
          <div className="card">
            <DocumentTextIcon className="w-8 h-8 text-primary-600 mb-3" />
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Auto Transcription
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Generate accurate transcripts with automatic language detection
            </p>
          </div>
          
          <div className="card">
            <SparklesIcon className="w-8 h-8 text-primary-600 mb-3" />
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Smart Summaries
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Get concise summaries in different formats for quick understanding
            </p>
          </div>
        </motion.div>
      )}

      {/* Info Notice */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
      >
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Supported Platforms:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>YouTube (including YouTube Shorts)</li>
              <li>Vimeo</li>
              <li>Dailymotion</li>
            </ul>
            <p className="mt-2">
              Note: Transcription quality depends on video audio quality and language clarity.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default VideoChat;