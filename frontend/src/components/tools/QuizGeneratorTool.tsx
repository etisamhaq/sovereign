import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { 
  ArrowPathIcon,
  AcademicCapIcon,
  QuestionMarkCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  BookOpenIcon,
  TrophyIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizGeneratorToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}

interface QuizResults {
  score: number;
  correct_answers: number;
  total_questions: number;
  feedback: string;
  question_results: {
    question_index: number;
    is_correct: boolean;
    user_answer: number;
    correct_answer: number;
    explanation: string;
  }[];
}

type QuizState = 'input' | 'taking' | 'results';

const QuizGeneratorTool: React.FC<QuizGeneratorToolProps> = ({ 
  tool, 
  isProcessing, 
  setIsProcessing 
}) => {
  const [text, setText] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [quizState, setQuizState] = useState<QuizState>('input');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizResults, setQuizResults] = useState<QuizResults | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const handleGenerateQuiz = async () => {
    if (!text.trim()) {
      toast.error('Please enter text to generate a quiz from');
      return;
    }

    if (text.length < 100) {
      toast.error('Please provide more content for better quiz generation');
      return;
    }

    setIsProcessing(true);
    setQuestions([]);
    setUserAnswers([]);
    setSelectedAnswer(null);
    setQuizResults(null);
    setShowExplanation(false);

    try {
      const response = await apiClient.post<{
        result: QuizQuestion[];
        usage_id: string;
        processing_time: number;
      }>('/tools/quiz-generator/', {
        text,
        num_questions: numQuestions,
      });

      if (response.result && Array.isArray(response.result)) {
        setQuestions(response.result);
        setQuizState('taking');
        setCurrentQuestionIndex(0);
        toast.success(`Generated ${response.result.length} quiz questions!`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate quiz');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    setShowExplanation(false);
  };

  const handleNextQuestion = () => {
    if (selectedAnswer === null) {
      toast.error('Please select an answer');
      return;
    }

    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = selectedAnswer;
    setUserAnswers(newAnswers);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(newAnswers[currentQuestionIndex + 1] ?? null);
      setShowExplanation(false);
    } else {
      // Quiz completed, evaluate answers
      evaluateQuiz(newAnswers);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setSelectedAnswer(userAnswers[currentQuestionIndex - 1] ?? null);
      setShowExplanation(false);
    }
  };

  const evaluateQuiz = async (answers: number[]) => {
    setIsProcessing(true);

    try {
      const response = await apiClient.post<{
        result: QuizResults;
        usage_id: string;
        processing_time: number;
      }>('/tools/quiz-generator/evaluate/', {
        questions,
        user_answers: answers,
      });

      if (response.result) {
        setQuizResults(response.result);
        setQuizState('results');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to evaluate quiz');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetakeQuiz = () => {
    setQuizState('taking');
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setSelectedAnswer(null);
    setQuizResults(null);
    setShowExplanation(false);
  };

  const handleStartOver = () => {
    setText('');
    setNumQuestions(5);
    setQuizState('input');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setSelectedAnswer(null);
    setQuizResults(null);
    setShowExplanation(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreEmoji = (score: number) => {
    if (score >= 90) return '🎉';
    if (score >= 80) return '🌟';
    if (score >= 70) return '👏';
    if (score >= 60) return '👍';
    return '💪';
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

      {/* Input State */}
      {quizState === 'input' && (
        <div className="card">
          <div className="space-y-6">
            {/* Text Input */}
            <div>
              <label htmlFor="text" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Study Material
              </label>
              <textarea
                id="text"
                rows={8}
                className="input"
                placeholder="Paste your study material, lecture notes, article, or any text you want to create a quiz from..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={10000}
              />
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex justify-between">
                <span>Provide the content to generate quiz questions</span>
                <span>{text.length}/10000</span>
              </div>
            </div>

            {/* Number of Questions */}
            <div>
              <label htmlFor="numQuestions" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Questions
              </label>
              <select
                id="numQuestions"
                className="input"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
              >
                <option value={3}>3 Questions (Quick Quiz)</option>
                <option value={5}>5 Questions (Standard)</option>
                <option value={10}>10 Questions (Comprehensive)</option>
                <option value={15}>15 Questions (Extended)</option>
                <option value={20}>20 Questions (Full Test)</option>
              </select>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateQuiz}
              disabled={isProcessing || !text.trim()}
              className="btn btn-primary w-full"
            >
              {isProcessing ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Generating Quiz...
                </>
              ) : (
                <>
                  <AcademicCapIcon className="h-5 w-5 mr-2" />
                  Generate Quiz
                </>
              )}
            </button>

            {/* Features */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                ✨ Quiz Features
              </h3>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Multiple choice questions with 4 options each</li>
                <li>• Detailed explanations for each answer</li>
                <li>• Instant scoring and personalized feedback</li>
                <li>• Review correct answers after completion</li>
                <li>• Track your progress and retake quizzes</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Taking Quiz State */}
      {quizState === 'taking' && questions.length > 0 && (
        <div className="card">
          <div className="space-y-6">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
                <span>{Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestionIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-start space-x-3">
                  <QuestionMarkCircleIcon className="h-6 w-6 text-primary-600 dark:text-primary-400 mt-1 flex-shrink-0" />
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                    {questions[currentQuestionIndex].question}
                  </h2>
                </div>

                {/* Answer Options */}
                <div className="space-y-3">
                  {questions[currentQuestionIndex].options.map((option, index) => {
                    const isSelected = selectedAnswer === index;
                    const isCorrect = index === questions[currentQuestionIndex].correct_answer;
                    const showResult = showExplanation;

                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswerSelect(index)}
                        disabled={showExplanation}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                          showResult
                            ? isCorrect
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                              : isSelected
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-gray-200 dark:border-gray-700'
                            : isSelected
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                              showResult
                                ? isCorrect
                                  ? 'border-green-500 bg-green-500'
                                  : isSelected
                                  ? 'border-red-500 bg-red-500'
                                  : 'border-gray-300 dark:border-gray-600'
                                : isSelected
                                ? 'border-primary-500 bg-primary-500'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {showResult && isCorrect && (
                                <CheckCircleIcon className="h-4 w-4 text-white" />
                              )}
                              {showResult && isSelected && !isCorrect && (
                                <XCircleIcon className="h-4 w-4 text-white" />
                              )}
                              {!showResult && isSelected && (
                                <div className="w-2 h-2 bg-white rounded-full" />
                              )}
                            </div>
                            <span className={`${
                              showResult && isCorrect
                                ? 'font-semibold text-green-700 dark:text-green-300'
                                : ''
                            }`}>
                              {String.fromCharCode(65 + index)}. {option}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Show Explanation Button */}
                {selectedAnswer !== null && !showExplanation && (
                  <button
                    onClick={() => setShowExplanation(true)}
                    className="btn btn-secondary"
                  >
                    <LightBulbIcon className="h-5 w-5 mr-2" />
                    Show Explanation
                  </button>
                )}

                {/* Explanation */}
                {showExplanation && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                  >
                    <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Explanation
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {questions[currentQuestionIndex].explanation}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              <button
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0}
                className="btn btn-secondary"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Previous
              </button>
              <button
                onClick={handleNextQuestion}
                disabled={selectedAnswer === null}
                className="btn btn-primary"
              >
                {currentQuestionIndex === questions.length - 1 ? (
                  <>
                    Submit Quiz
                    <CheckCircleIcon className="h-5 w-5 ml-2" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRightIcon className="h-5 w-5 ml-2" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results State */}
      {quizState === 'results' && quizResults && (
        <div className="space-y-6">
          {/* Score Card */}
          <div className="card text-center">
            <TrophyIcon className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Quiz Completed!
            </h2>
            <div className={`text-5xl font-bold ${getScoreColor(quizResults.score)} mb-4`}>
              {Math.round(quizResults.score)}% {getScoreEmoji(quizResults.score)}
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
              You got {quizResults.correct_answers} out of {quizResults.total_questions} questions correct
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              {quizResults.feedback}
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={handleRetakeQuiz} className="btn btn-primary">
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                Retake Quiz
              </button>
              <button onClick={handleStartOver} className="btn btn-secondary">
                <BookOpenIcon className="h-5 w-5 mr-2" />
                New Quiz
              </button>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Review Answers
            </h3>
            <div className="space-y-4">
              {questions.map((question, index) => {
                const result = quizResults.question_results[index];
                const isCorrect = result?.is_correct ?? false;

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 ${
                      isCorrect
                        ? 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800'
                        : 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {isCorrect ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
                      ) : (
                        <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400 mt-1 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                          {index + 1}. {question.question}
                        </h4>
                        <div className="space-y-1 text-sm">
                          {result?.user_answer !== undefined && result.user_answer >= 0 && (
                            <p className="text-gray-600 dark:text-gray-400">
                              Your answer: <span className={isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                {String.fromCharCode(65 + result.user_answer)}. {question.options[result.user_answer]}
                              </span>
                            </p>
                          )}
                          {!isCorrect && (
                            <p className="text-gray-600 dark:text-gray-400">
                              Correct answer: <span className="text-green-600 dark:text-green-400">
                                {String.fromCharCode(65 + question.correct_answer)}. {question.options[question.correct_answer]}
                              </span>
                            </p>
                          )}
                          <p className="text-gray-600 dark:text-gray-400 mt-2">
                            {question.explanation}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizGeneratorTool;
