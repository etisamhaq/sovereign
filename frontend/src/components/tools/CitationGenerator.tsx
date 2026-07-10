import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { ClipboardDocumentIcon, ArrowPathIcon, BookOpenIcon } from '@heroicons/react/24/outline';

interface CitationGeneratorProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

interface SourceInfo {
  type: 'book' | 'journal' | 'website' | 'newspaper' | 'magazine';
  authors?: string;
  title: string;
  year?: string;
  publisher?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;
  accessDate?: string;
  doi?: string;
  edition?: string;
  city?: string;
}

const CitationGenerator: React.FC<CitationGeneratorProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [citationStyle, setCitationStyle] = useState<'apa' | 'mla' | 'chicago' | 'harvard' | 'ieee'>('apa');
  const [sourceType, setSourceType] = useState<SourceInfo['type']>('book');
  const [sourceInfo, setSourceInfo] = useState<SourceInfo>({
    type: 'book',
    title: '',
  });
  const [generatedCitation, setGeneratedCitation] = useState('');

  const citationStyles = [
    { value: 'apa', label: 'APA 7th Edition' },
    { value: 'mla', label: 'MLA 9th Edition' },
    { value: 'chicago', label: 'Chicago 17th Edition' },
    { value: 'harvard', label: 'Harvard' },
    { value: 'ieee', label: 'IEEE' },
  ];

  const sourceTypes = [
    { value: 'book', label: 'Book', icon: '📚' },
    { value: 'journal', label: 'Journal Article', icon: '📰' },
    { value: 'website', label: 'Website', icon: '🌐' },
    { value: 'newspaper', label: 'Newspaper', icon: '📄' },
    { value: 'magazine', label: 'Magazine', icon: '📖' },
  ];

  const handleInputChange = (field: keyof SourceInfo, value: string) => {
    setSourceInfo(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleGenerateCitation = async () => {
    // Validate required fields
    if (!sourceInfo.title.trim()) {
      toast.error('Please enter the title of the source');
      return;
    }

    if (sourceType === 'website' && !sourceInfo.url) {
      toast.error('Please enter the URL for the website');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{
        result: string;
        usage_id: string;
        processing_time: number;
      }>('/tools/citation-generator/', {
        source_info: {
          ...sourceInfo,
          type: sourceType,
        },
        style: citationStyle,
      });

      setGeneratedCitation(response.result);
      toast.success('Citation generated successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate citation');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCitation);
    toast.success('Citation copied to clipboard!');
  };

  const handleReset = () => {
    setSourceInfo({
      type: sourceType,
      title: '',
    });
    setGeneratedCitation('');
  };

  const renderSourceFields = () => {
    switch (sourceType) {
      case 'book':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Author(s) *
              </label>
              <input
                type="text"
                className="input mt-1"
                placeholder="Last, First M.; Last, First M."
                value={sourceInfo.authors || ''}
                onChange={(e) => handleInputChange('authors', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Title *
              </label>
              <input
                type="text"
                className="input mt-1"
                placeholder="Book Title"
                value={sourceInfo.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Year
                </label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="2024"
                  value={sourceInfo.year || ''}
                  onChange={(e) => handleInputChange('year', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Edition
                </label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="2nd"
                  value={sourceInfo.edition || ''}
                  onChange={(e) => handleInputChange('edition', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Publisher
                </label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="Publisher Name"
                  value={sourceInfo.publisher || ''}
                  onChange={(e) => handleInputChange('publisher', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  City
                </label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="New York"
                  value={sourceInfo.city || ''}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                />
              </div>
            </div>
          </>
        );

      case 'journal':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Author(s) *
              </label>
              <input
                type="text"
                className="input mt-1"
                placeholder="Last, First M.; Last, First M."
                value={sourceInfo.authors || ''}
                onChange={(e) => handleInputChange('authors', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Article Title *
              </label>
              <input
                type="text"
                className="input mt-1"
                placeholder="Article Title"
                value={sourceInfo.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Journal Name
              </label>
              <input
                type="text"
                className="input mt-1"
                placeholder="Journal of Example Studies"
                value={sourceInfo.journal || ''}
                onChange={(e) => handleInputChange('journal', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Volume
                </label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="12"
                  value={sourceInfo.volume || ''}
                  onChange={(e) => handleInputChange('volume', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Issue
                </label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="3"
                  value={sourceInfo.issue || ''}
                  onChange={(e) => handleInputChange('issue', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Pages
                </label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="123-145"
                  value={sourceInfo.pages || ''}
                  onChange={(e) => handleInputChange('pages', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Year
                </label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="2024"
                  value={sourceInfo.year || ''}
                  onChange={(e) => handleInputChange('year', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                DOI (optional)
              </label>
              <input
                type="text"
                className="input mt-1"
                placeholder="10.1234/example"
                value={sourceInfo.doi || ''}
                onChange={(e) => handleInputChange('doi', e.target.value)}
              />
            </div>
          </>
        );

      case 'website':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Author/Organization
              </label>
              <input
                type="text"
                className="input mt-1"
                placeholder="Author Name or Organization"
                value={sourceInfo.authors || ''}
                onChange={(e) => handleInputChange('authors', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Page Title *
              </label>
              <input
                type="text"
                className="input mt-1"
                placeholder="Web Page Title"
                value={sourceInfo.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                URL *
              </label>
              <input
                type="url"
                className="input mt-1"
                placeholder="https://example.com/page"
                value={sourceInfo.url || ''}
                onChange={(e) => handleInputChange('url', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Publication Year
                </label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="2024"
                  value={sourceInfo.year || ''}
                  onChange={(e) => handleInputChange('year', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Access Date
                </label>
                <input
                  type="date"
                  className="input mt-1"
                  value={sourceInfo.accessDate || ''}
                  onChange={(e) => handleInputChange('accessDate', e.target.value)}
                />
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          {tool.name}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {tool.description}
        </p>
      </div>

      <div className="card">
        <div className="space-y-6">
          {/* Citation Style Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Citation Style
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {citationStyles.map((style) => (
                <button
                  key={style.value}
                  onClick={() => setCitationStyle(style.value as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    citationStyle === style.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Source Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {sourceTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => {
                    setSourceType(type.value as SourceInfo['type']);
                    setSourceInfo({ type: type.value as SourceInfo['type'], title: '' });
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center ${
                    sourceType === type.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="mr-2">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source Information Fields */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Source Information
            </h3>
            {renderSourceFields()}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleGenerateCitation}
              disabled={isProcessing || !sourceInfo.title.trim()}
              className="btn btn-primary flex-1"
            >
              {isProcessing ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <BookOpenIcon className="h-5 w-5 mr-2" />
                  Generate Citation
                </>
              )}
            </button>
            <button onClick={handleReset} className="btn btn-secondary">
              Reset
            </button>
          </div>

          {/* Generated Citation */}
          {generatedCitation && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Generated Citation ({citationStyle.toUpperCase()})
                </h3>
                <button
                  onClick={copyToClipboard}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center"
                >
                  <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                  Copy
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono text-sm">
                  {generatedCitation}
                </p>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p className="font-medium mb-1">Pro Tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Always double-check generated citations for accuracy</li>
                  <li>Some fields may be optional depending on the citation style</li>
                  <li>Use the exact format required by your institution</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CitationGenerator;