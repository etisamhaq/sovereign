import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../../services/api';
import {
  PhotoIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  SparklesIcon,
  ChartBarIcon,
  XMarkIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

interface ImageComparisonProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

interface ComparisonResult {
  success: boolean;
  identical_matches?: Array<{
    source: string;
    target: string;
    score: number;
    metadata: any;
  }>;
  similar_matches?: Array<{
    source: string;
    target: string;
    score: number;
    metadata: any;
  }>;
  statistics?: {
    total_identical: number;
    total_similar: number;
    images_in_folder_a: number;
    images_in_folder_b: number;
    images_in_folder_c: number;
  };
  error?: string;
}

const ImageComparison: React.FC<ImageComparisonProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [folderA, setFolderA] = useState<File[]>([]);
  const [folderB, setFolderB] = useState<File[]>([]);
  const [folderC, setFolderC] = useState<File[]>([]);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.7);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'results'>('upload');
  const [isDragging, setIsDragging] = useState<'a' | 'b' | 'c' | null>(null);
  
  const folderARef = useRef<HTMLInputElement>(null);
  const folderBRef = useRef<HTMLInputElement>(null);
  const folderCRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (files: FileList, folder: 'a' | 'b' | 'c') => {
    const imageFiles = Array.from(files).filter(file => 
      file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/png'
    );
    
    if (imageFiles.length === 0) {
      toast.error('Please upload only JPEG/PNG images');
      return;
    }
    
    if (imageFiles.length > 50) {
      toast.error('Maximum 50 images per folder allowed');
      return;
    }
    
    switch (folder) {
      case 'a':
        setFolderA(imageFiles);
        break;
      case 'b':
        setFolderB(imageFiles);
        break;
      case 'c':
        setFolderC(imageFiles);
        break;
    }
    
    toast.success(`${imageFiles.length} images uploaded to Folder ${folder.toUpperCase()}`);
  };

  const handleDrop = useCallback((e: React.DragEvent, folder: 'a' | 'b' | 'c') => {
    e.preventDefault();
    setIsDragging(null);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files, folder);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, folder: 'a' | 'b' | 'c') => {
    e.preventDefault();
    setIsDragging(folder);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(null);
  }, []);

  const handleCompare = async () => {
    if (folderA.length === 0 || folderB.length === 0 || folderC.length === 0) {
      toast.error('Please upload images to all three folders');
      return;
    }
    
    setIsProcessing(true);
    const formData = new FormData();
    
    // Add folder A images
    folderA.forEach(file => {
      formData.append('folder_a', file);
    });
    
    // Add folder B images
    folderB.forEach(file => {
      formData.append('folder_b', file);
    });
    
    // Add folder C images
    folderC.forEach(file => {
      formData.append('folder_c', file);
    });
    
    formData.append('similarity_threshold', similarityThreshold.toString());
    
    try {
      const result = await apiClient.post<ComparisonResult>('/tools/image-comparison/compare/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (result.success) {
        setComparisonResult(result);
        setActiveTab('results');
        toast.success('Image comparison completed successfully!');
      } else {
        toast.error(result.error || 'Comparison failed');
      }
    } catch (error: any) {
      console.error('Comparison error:', error);
      toast.error(error.response?.data?.error || 'Failed to compare images');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearFolder = (folder: 'a' | 'b' | 'c') => {
    switch (folder) {
      case 'a':
        setFolderA([]);
        break;
      case 'b':
        setFolderB([]);
        break;
      case 'c':
        setFolderC([]);
        break;
    }
    toast.success(`Folder ${folder.toUpperCase()} cleared`);
  };

  const resetAll = () => {
    setFolderA([]);
    setFolderB([]);
    setFolderC([]);
    setComparisonResult(null);
    setActiveTab('upload');
    setSimilarityThreshold(0.7);
    toast.success('All data cleared');
  };

  const FolderUpload = ({ 
    folder, 
    files, 
    inputRef, 
    label, 
    description 
  }: { 
    folder: 'a' | 'b' | 'c';
    files: File[];
    inputRef: React.RefObject<HTMLInputElement | null>;
    label: string;
    description: string;
  }) => (
    <div
      className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
        isDragging === folder ? 'border-purple-500 bg-purple-50' : 'border-gray-300'
      }`}
      onDrop={(e) => handleDrop(e, folder)}
      onDragOver={(e) => handleDragOver(e, folder)}
      onDragLeave={handleDragLeave}
    >
      <div className="text-center">
        <FolderOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">{label}</h3>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <PhotoIcon className="h-4 w-4 mr-2" />
            Choose Files
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files, folder)}
          />
        </div>
        {files.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600">{files.length} images selected</p>
            <button
              onClick={() => clearFolder(folder)}
              className="mt-2 text-xs text-red-600 hover:text-red-800"
            >
              Clear Folder
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center">
                <PhotoIcon className="h-8 w-8 mr-3" />
                {tool.name}
              </h2>
              <p className="text-purple-100 mt-1">{tool.description}</p>
            </div>
            <SparklesIcon className="h-10 w-10 text-purple-200" />
          </div>
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-2 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Upload Images
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`py-2 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'results'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              disabled={!comparisonResult}
            >
              Results
            </button>
          </nav>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex">
                    <InformationCircleIcon className="h-5 w-5 text-blue-400 mr-2" />
                    <div className="text-sm text-blue-700">
                      <p className="font-semibold mb-1">How it works:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Supports JPEG and PNG image formats</li>
                        <li>Folder A: Source images to compare</li>
                        <li>Folder B: Images to find identical matches</li>
                        <li>Folder C: Images to find similar matches based on shape, design, and geometry</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FolderUpload
                    folder="a"
                    files={folderA}
                    inputRef={folderARef}
                    label="Folder A (Source)"
                    description="Upload source JPEG images"
                  />
                  <FolderUpload
                    folder="b"
                    files={folderB}
                    inputRef={folderBRef}
                    label="Folder B (Identical)"
                    description="For identical matching"
                  />
                  <FolderUpload
                    folder="c"
                    files={folderC}
                    inputRef={folderCRef}
                    label="Folder C (Similar)"
                    description="For similarity matching"
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700">
                    Similarity Threshold:
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={similarityThreshold}
                    onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium text-gray-900 w-12">
                    {(similarityThreshold * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={resetAll}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <XMarkIcon className="h-4 w-4 inline mr-2" />
                    Reset All
                  </button>
                  <button
                    onClick={handleCompare}
                    disabled={isProcessing || folderA.length === 0 || folderB.length === 0 || folderC.length === 0}
                    className="px-6 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <ArrowPathIcon className="h-4 w-4 inline mr-2 animate-spin" />
                        Comparing...
                      </>
                    ) : (
                      <>
                        <MagnifyingGlassIcon className="h-4 w-4 inline mr-2" />
                        Compare Images
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'results' && comparisonResult && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {comparisonResult.statistics && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <ChartBarIcon className="h-5 w-5 mr-2" />
                      Statistics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {comparisonResult.statistics.images_in_folder_a}
                        </p>
                        <p className="text-xs text-gray-600">Folder A Images</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {comparisonResult.statistics.images_in_folder_b}
                        </p>
                        <p className="text-xs text-gray-600">Folder B Images</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {comparisonResult.statistics.images_in_folder_c}
                        </p>
                        <p className="text-xs text-gray-600">Folder C Images</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {comparisonResult.statistics.total_identical}
                        </p>
                        <p className="text-xs text-gray-600">Identical Matches</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {comparisonResult.statistics.total_similar}
                        </p>
                        <p className="text-xs text-gray-600">Similar Matches</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <CheckCircleIcon className="h-5 w-5 mr-2 text-green-600" />
                      Identical Matches (Folder A → B)
                    </h3>
                    {comparisonResult.identical_matches && comparisonResult.identical_matches.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {comparisonResult.identical_matches.map((match, idx) => (
                          <div key={idx} className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {match.source} → {match.target}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  Score: {(match.score * 100).toFixed(1)}%
                                </p>
                              </div>
                              <DocumentDuplicateIcon className="h-4 w-4 text-green-600" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No identical matches found</p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <SparklesIcon className="h-5 w-5 mr-2 text-blue-600" />
                      Similar Matches (Folder A → C)
                    </h3>
                    {comparisonResult.similar_matches && comparisonResult.similar_matches.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {comparisonResult.similar_matches.map((match, idx) => (
                          <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {match.source} → {match.target}
                                </p>
                                <div className="text-xs text-gray-600 mt-1">
                                  <p>Overall: {(match.score * 100).toFixed(1)}%</p>
                                  {match.metadata && (
                                    <div className="mt-1 space-y-0.5">
                                      {match.metadata.deep_similarity !== undefined && (
                                        <p>Deep Learning: {(match.metadata.deep_similarity * 100).toFixed(1)}%</p>
                                      )}
                                      {match.metadata.geometric_similarity !== undefined && (
                                        <p>Geometric: {(match.metadata.geometric_similarity * 100).toFixed(1)}%</p>
                                      )}
                                      {match.metadata.color_similarity !== undefined && (
                                        <p>Color: {(match.metadata.color_similarity * 100).toFixed(1)}%</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <SparklesIcon className="h-4 w-4 text-blue-600" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No similar matches found above threshold</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-center mt-6">
                  <button
                    onClick={resetAll}
                    className="px-6 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
                  >
                    Start New Comparison
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ImageComparison;