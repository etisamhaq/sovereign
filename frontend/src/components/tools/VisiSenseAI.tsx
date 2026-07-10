import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '../../services/api';
import {
  EyeIcon,
  PhotoIcon,
  LanguageIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
  XMarkIcon,
  InformationCircleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

interface VisiSenseAIProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

interface AnalysisResult {
  analysis?: string;
  extracted_text?: string;
  detected_language?: string;
  word_count?: number;
  error?: string;
  success?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

const VisiSenseAI: React.FC<VisiSenseAIProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [imageData, setImageData] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'chat' | 'tools'>('upload');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [summaryType, setSummaryType] = useState('concise');
  const [infoType, setInfoType] = useState('general');
  const [targetLanguage, setTargetLanguage] = useState('English');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleImageUpload = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImageData(base64String);
        setImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    } else {
      toast.error('Please upload a valid image file');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageUpload(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleImageUpload(file);
        }
      }
    }
  }, []);

  const analyzeImage = async () => {
    if (!imageData) {
      toast.error('Please upload an image first');
      return;
    }

    setIsAnalyzing(true);
    setIsProcessing(true);

    try {
      const response: any = await apiClient.post('/tools/visisense-ai/analyze/', {
        image: imageData,
        question: question || undefined,
        language: 'eng'
      });

      const result = response.result as AnalysisResult;
      setAnalysisResult(result);

      if (result.extracted_text) {
        setExtractedText(result.extracted_text);
      }

      if (result.success) {
        toast.success('Image analyzed successfully!');
        setActiveTab('chat');

        // Add to chat history
        if (question) {
          setChatHistory([
            { role: 'user', content: question },
            { role: 'assistant', content: result.analysis || '' }
          ]);
        }
      } else {
        toast.error(result.error || 'Analysis failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
      setIsProcessing(false);
    }
  };

  const askQuestion = async (newQuestion: string) => {
    if (!extractedText) {
      toast.error('Please analyze an image first');
      return;
    }

    if (!newQuestion.trim()) {
      toast.error('Please enter a question');
      return;
    }

    setIsProcessing(true);

    try {
      const response: any = await apiClient.post('/tools/visisense-ai/question/', {
        extracted_text: extractedText,
        question: newQuestion,
        chat_history: chatHistory
      });

      const answer = response.result.answer;

      // Update chat history
      setChatHistory([
        ...chatHistory,
        { role: 'user', content: newQuestion },
        { role: 'assistant', content: answer }
      ]);

      setQuestion('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to get answer');
    } finally {
      setIsProcessing(false);
    }
  };

  const translateText = async () => {
    if (!extractedText) {
      toast.error('No text to translate');
      return;
    }

    setIsProcessing(true);

    try {
      const response: any = await apiClient.post('/tools/visisense-ai/translate/', {
        text: extractedText,
        target_language: targetLanguage
      });

      const translation = response.result.translation;

      // Add to chat as a special message
      setChatHistory([
        ...chatHistory,
        {
          role: 'assistant',
          content: `**Translation to ${targetLanguage}:**\n\n${translation}`
        }
      ]);

      toast.success('Text translated successfully and available in chat section!');
    } catch (error: any) {
      toast.error(error.message || 'Translation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateSummary = async () => {
    if (!extractedText) {
      toast.error('No text to summarize');
      return;
    }

    setIsProcessing(true);

    try {
      const response: any = await apiClient.post('/tools/visisense-ai/summary/', {
        text: extractedText,
        summary_type: summaryType
      });

      const summary = response.result.summary;

      // Add to chat
      setChatHistory([
        ...chatHistory,
        {
          role: 'assistant',
          content: `**${summaryType.charAt(0).toUpperCase() + summaryType.slice(1)} Summary:**\n\n${summary}`
        }
      ]);

      toast.success('Summary generated and available in chat section!');
    } catch (error: any) {
      toast.error(error.message || 'Summary generation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const extractInformation = async () => {
    if (!extractedText) {
      toast.error('No text to extract from');
      return;
    }

    setIsProcessing(true);

    try {
      const response: any = await apiClient.post('/tools/visisense-ai/extract/', {
        text: extractedText,
        info_type: infoType
      });

      const extracted = response.result;

      // Format extracted information
      let formattedContent = `**Extracted ${infoType} information:**\n\n`;
      if (extracted.extracted_items && extracted.extracted_items.length > 0) {
        formattedContent += extracted.extracted_items.map((item: string, i: number) =>
          `${i + 1}. ${item}`
        ).join('\n');
      }
      if (extracted.summary) {
        formattedContent += `\n\n**Summary:** ${extracted.summary}`;
      }

      setChatHistory([
        ...chatHistory,
        { role: 'assistant', content: formattedContent }
      ]);

      toast.success('Information extracted and available in chat section!');
    } catch (error: any) {
      toast.error(error.message || 'Extraction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const clearAll = () => {
    setImageData('');
    setImagePreview('');
    setQuestion('');
    setAnalysisResult(null);
    setExtractedText('');
    setChatHistory([]);
    setActiveTab('upload');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-4">
          <EyeIcon className="h-8 w-8 text-primary-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {tool.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {tool.description}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700">
          {['upload', 'chat', 'tools'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab === 'upload' && <PhotoIcon className="inline h-5 w-5 mr-2" />}
              {tab === 'chat' && <ChatBubbleLeftRightIcon className="inline h-5 w-5 mr-2" />}
              {tab === 'tools' && <SparklesIcon className="inline h-5 w-5 mr-2" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onPaste={handlePaste}
          >
            {imagePreview ? (
              <div className="space-y-4">
                <img
                  src={imagePreview}
                  alt="Uploaded"
                  className="max-h-96 mx-auto rounded-lg shadow-lg"
                />
                <button
                  onClick={clearAll}
                  className="btn btn-outline-danger"
                >
                  <XMarkIcon className="h-5 w-5 mr-2" />
                  Remove Image
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <PhotoIcon className="h-16 w-16 mx-auto text-gray-400" />
                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    Drop an image here, paste from clipboard, or click to browse
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Supports JPG, PNG, GIF, BMP, WebP (Max 10MB)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-primary"
                >
                  Choose Image
                </button>
              </div>
            )}
          </div>

          {imagePreview && (
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ask a question about this image (optional)
                </label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., What does this text mean? Translate the highlighted term..."
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  rows={3}
                />
              </div>

              <button
                onClick={analyzeImage}
                disabled={isAnalyzing}
                className="btn btn-primary w-full"
              >
                {isAnalyzing ? (
                  <>
                    <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                    Analyze Image
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          {extractedText ? (
            <div className="space-y-4">
              {/* Extracted Text Display */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Extracted Text
                  </h3>
                  <button
                    onClick={() => copyToClipboard(extractedText)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <ClipboardDocumentIcon className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {extractedText}
                </p>
                {analysisResult && (
                  <div className="mt-2 flex space-x-4 text-xs text-gray-500">
                    <span>Language: {analysisResult.detected_language}</span>
                    <span>Words: {analysisResult.word_count}</span>
                  </div>
                )}
              </div>

              {/* Chat History */}
              {chatHistory.length > 0 && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {chatHistory.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-3xl rounded-lg px-4 py-2 ${
                          msg.role === 'user'
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Question Input */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && askQuestion(question)}
                  placeholder="Ask a question about the content..."
                  className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                />
                <button
                  onClick={() => askQuestion(question)}
                  disabled={isProcessing || !question.trim()}
                  className="btn btn-primary"
                >
                  Ask
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <InformationCircleIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Please upload and analyze an image first to start chatting
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="btn btn-primary mt-4"
              >
                Upload Image
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Tools Tab */}
      {activeTab === 'tools' && extractedText && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Translation Tool */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              <LanguageIcon className="inline h-5 w-5 mr-2" />
              Translate Text
            </h3>
            <div className="flex space-x-2">
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              >
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Italian">Italian</option>
                <option value="Portuguese">Portuguese</option>
                <option value="Chinese">Chinese</option>
                <option value="Japanese">Japanese</option>
                <option value="Korean">Korean</option>
                <option value="Arabic">Arabic</option>
                <option value="Hindi">Hindi</option>
                <option value="Urdu">Urdu</option>
              </select>
              <button
                onClick={translateText}
                disabled={isProcessing}
                className="btn btn-primary"
              >
                Translate
              </button>
            </div>
          </div>

          {/* Summary Tool */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              <DocumentTextIcon className="inline h-5 w-5 mr-2" />
              Generate Summary
            </h3>
            <div className="flex space-x-2">
              <select
                value={summaryType}
                onChange={(e) => setSummaryType(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              >
                <option value="concise">Concise (2-3 sentences)</option>
                <option value="detailed">Detailed</option>
                <option value="bullets">Bullet Points</option>
                <option value="academic">Academic Abstract</option>
                <option value="simplified">Simplified</option>
              </select>
              <button
                onClick={generateSummary}
                disabled={isProcessing}
                className="btn btn-primary"
              >
                Summarize
              </button>
            </div>
          </div>

          {/* Information Extraction Tool */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              <MagnifyingGlassIcon className="inline h-5 w-5 mr-2" />
              Extract Information
            </h3>
            <div className="flex space-x-2">
              <select
                value={infoType}
                onChange={(e) => setInfoType(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              >
                <option value="general">General Information</option>
                <option value="definitions">Definitions & Terms</option>
                <option value="numbers">Numbers & Statistics</option>
                <option value="names">Names & Entities</option>
                <option value="actions">Actions & Instructions</option>
                <option value="questions">Questions</option>
                <option value="code">Code & Commands</option>
              </select>
              <button
                onClick={extractInformation}
                disabled={isProcessing}
                className="btn btn-primary"
              >
                Extract
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty State for Tools Tab */}
      {activeTab === 'tools' && !extractedText && (
        <div className="card text-center py-8">
          <SparklesIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Analyze an image first to access advanced tools
          </p>
          <button
            onClick={() => setActiveTab('upload')}
            className="btn btn-primary mt-4"
          >
            Upload Image
          </button>
        </div>
      )}
    </div>
  );
};

export default VisiSenseAI;