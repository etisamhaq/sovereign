import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { 
  ArrowPathIcon, 
  DocumentDuplicateIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AcademicCapIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface FlashcardCreatorProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

interface Flashcard {
  question: string;
  answer: string;
}

const FlashcardCreator: React.FC<FlashcardCreatorProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [inputText, setInputText] = useState('');
  const [numCards, setNumCards] = useState(10);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const handleGenerateFlashcards = async () => {
    if (!inputText.trim()) {
      toast.error('Please enter some text to create flashcards from');
      return;
    }

    if (inputText.length < 100) {
      toast.error('Please provide more text (at least 100 characters) for better flashcard generation');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{
        result: Flashcard[];
        usage_id: string;
        processing_time: number;
      }>('/tools/flashcard-creator/', {
        text: inputText,
        num_cards: numCards,
      });

      if (response.result && Array.isArray(response.result)) {
        setFlashcards(response.result);
        setCurrentCardIndex(0);
        setShowAnswer(false);
        toast.success(`Generated ${response.result.length} flashcards!`);
      } else {
        toast.error('Invalid response format');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate flashcards');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePreviousCard = () => {
    setCurrentCardIndex((prev) => (prev > 0 ? prev - 1 : flashcards.length - 1));
    setShowAnswer(false);
  };

  const handleNextCard = () => {
    setCurrentCardIndex((prev) => (prev < flashcards.length - 1 ? prev + 1 : 0));
    setShowAnswer(false);
  };

  const handleFlipCard = () => {
    setShowAnswer(!showAnswer);
  };

  const copyAllFlashcards = () => {
    const text = flashcards
      .map((card, index) => `Card ${index + 1}:\nQ: ${card.question}\nA: ${card.answer}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    toast.success('All flashcards copied to clipboard!');
  };

  const exportAsCSV = () => {
    const csv = [
      'Question,Answer',
      ...flashcards.map(card => `"${card.question.replace(/"/g, '""')}","${card.answer.replace(/"/g, '""')}"`)
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flashcards.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Flashcards exported as CSV!');
  };

  const handleReset = () => {
    setInputText('');
    setFlashcards([]);
    setCurrentCardIndex(0);
    setShowAnswer(false);
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
        <div className="space-y-4">
          <div>
            <label htmlFor="input-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Study Material
            </label>
            <textarea
              id="input-text"
              rows={8}
              className="input"
              placeholder="Paste your study material, lecture notes, or any educational content here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              maxLength={10000}
            />
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex justify-between">
              <span>{inputText.length}/10000 characters</span>
              <span>Min. 100 characters recommended</span>
            </div>
          </div>

          <div>
            <label htmlFor="num-cards" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Number of Flashcards
            </label>
            <div className="flex items-center space-x-4">
              <input
                id="num-cards"
                type="range"
                min="5"
                max="30"
                value={numCards}
                onChange={(e) => setNumCards(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-lg font-medium text-gray-900 dark:text-white w-12 text-center">
                {numCards}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGenerateFlashcards}
              disabled={isProcessing || !inputText.trim() || inputText.length < 100}
              className="btn btn-primary flex-1"
            >
              {isProcessing ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <AcademicCapIcon className="h-5 w-5 mr-2" />
                  Generate Flashcards
                </>
              )}
            </button>
            <button onClick={handleReset} className="btn btn-secondary">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Flashcards Display */}
      {flashcards.length > 0 && (
        <div className="space-y-4">
          {/* View Mode Toggle */}
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Generated Flashcards ({flashcards.length})
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('card')}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  viewMode === 'card'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Card View
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  viewMode === 'list'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                List View
              </button>
            </div>
          </div>

          {viewMode === 'card' ? (
            /* Card View */
            <div className="space-y-4">
              <div className="relative h-96">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentCardIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0"
                  >
                    <div
                      onClick={handleFlipCard}
                      className="h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 cursor-pointer transform transition-transform hover:scale-[1.02]"
                    >
                      <div className="p-8 h-full flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Card {currentCardIndex + 1} of {flashcards.length}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Click to flip
                          </span>
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                          <div className="text-center">
                            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-4">
                              {showAnswer ? 'Answer' : 'Question'}
                            </h3>
                            <p className="text-xl text-gray-900 dark:text-white">
                              {showAnswer
                                ? flashcards[currentCardIndex].answer
                                : flashcards[currentCardIndex].question}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation Controls */}
              <div className="flex justify-between items-center">
                <button
                  onClick={handlePreviousCard}
                  className="btn btn-outline flex items-center"
                >
                  <ChevronLeftIcon className="h-5 w-5 mr-1" />
                  Previous
                </button>
                <div className="flex space-x-2">
                  {flashcards.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentCardIndex(index);
                        setShowAnswer(false);
                      }}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === currentCardIndex
                          ? 'bg-primary-600'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={handleNextCard}
                  className="btn btn-outline flex items-center"
                >
                  Next
                  <ChevronRightIcon className="h-5 w-5 ml-1" />
                </button>
              </div>
            </div>
          ) : (
            /* List View */
            <div className="space-y-4">
              <div className="max-h-96 overflow-y-auto space-y-3">
                {flashcards.map((card, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                  >
                    <div className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Question:</p>
                          <p className="text-gray-900 dark:text-white">{card.question}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Answer:</p>
                          <p className="text-gray-900 dark:text-white">{card.answer}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Options */}
          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={copyAllFlashcards}
              className="btn btn-outline flex items-center"
            >
              <ClipboardDocumentIcon className="h-5 w-5 mr-2" />
              Copy All
            </button>
            <button
              onClick={exportAsCSV}
              className="btn btn-outline flex items-center"
            >
              <DocumentDuplicateIcon className="h-5 w-5 mr-2" />
              Export CSV
            </button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Study Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Review flashcards regularly using spaced repetition</li>
              <li>Try to answer before flipping the card</li>
              <li>Export to CSV to use with other flashcard apps like Anki</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashcardCreator;