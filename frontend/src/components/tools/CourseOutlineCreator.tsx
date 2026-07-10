import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../services/api';
import { toast } from 'react-hot-toast';
import { 
  AcademicCapIcon, 
  ClockIcon, 
  UserGroupIcon, 
  BookOpenIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  LightBulbIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';

interface Module {
  moduleNumber: number;
  title: string;
  duration: string;
  objectives: string[];
  lessons: Lesson[];
  assignments: Assignment[];
}

interface Lesson {
  title: string;
  duration: string;
  topics: string[];
  activities: string[];
  resources: string[];
}

interface Assignment {
  title: string;
  description: string;
  type: string;
}

interface CourseOutline {
  courseTitle: string;
  courseSummary: string;
  duration: string;
  level: string;
  prerequisites: string[];
  learningObjectives: string[];
  modules: Module[];
  assessmentStrategy: {
    formative: string[];
    summative: string[];
    grading: string;
  };
  resources: Array<{
    type: string;
    title: string;
    description: string;
  }>;
}

const CourseOutlineCreator: React.FC = () => {
  const [formData, setFormData] = useState({
    topic: '',
    target_audience: '',
    duration: '',
    level: 'beginner',
    format: 'mixed',
    learning_goals: '',
    prerequisites: ''
  });
  const [result, setResult] = useState<CourseOutline | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());

  const generateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiClient.post('/tools/course-outline-creator/', data);
    },
    onSuccess: (data: any) => {
      if (data.result?.error) {
        toast.error(data.result.error || 'Failed to generate course outline');
      } else if (data.result?.modules && Array.isArray(data.result.modules)) {
        setResult(data.result);
        toast.success('Course outline generated successfully!');
      } else {
        toast.error('Invalid response format. Please try again.');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to generate course outline');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.topic.trim() || !formData.target_audience.trim() || !formData.duration.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    generateMutation.mutate(formData);
  };

  const toggleModule = (moduleNumber: number) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleNumber)) {
      newExpanded.delete(moduleNumber);
    } else {
      newExpanded.add(moduleNumber);
    }
    setExpandedModules(newExpanded);
  };

  const exportOutline = () => {
    if (!result) return;

    const content = `# ${result.courseTitle}

## Course Summary
${result.courseSummary}

## Course Details
- **Duration**: ${result.duration}
- **Level**: ${result.level}
- **Format**: ${formData.format}

## Prerequisites
${result.prerequisites.length > 0 ? result.prerequisites.join('\n- ') : 'None'}

## Learning Objectives
${result.learningObjectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}

## Course Modules
${result.modules.map(module => `
### Module ${module.moduleNumber}: ${module.title}
**Duration**: ${module.duration}

**Objectives**:
${module.objectives.map(obj => `- ${obj}`).join('\n')}

**Lessons**:
${module.lessons.map(lesson => `
#### ${lesson.title} (${lesson.duration})
- Topics: ${lesson.topics.join(', ')}
- Activities: ${lesson.activities.join(', ')}
`).join('\n')}

**Assignments**:
${module.assignments.map(assignment => `- ${assignment.title} (${assignment.type}): ${assignment.description}`).join('\n')}
`).join('\n')}

## Assessment Strategy
### Formative Assessments
${result.assessmentStrategy.formative.map(item => `- ${item}`).join('\n')}

### Summative Assessments
${result.assessmentStrategy.summative.map(item => `- ${item}`).join('\n')}

### Grading
${result.assessmentStrategy.grading}

## Resources
${result.resources.map(resource => `- **${resource.title}** (${resource.type}): ${resource.description}`).join('\n')}
`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.courseTitle.replace(/\s+/g, '-').toLowerCase()}-outline.md`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Course outline exported successfully!');
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full mb-4">
            <AcademicCapIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            AI Course Outline Creator
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Generate comprehensive course outlines with modules, lessons, learning objectives, and assessments in minutes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl mx-auto mb-8">
          {/* Course Topic */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Course Topic <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="e.g., Introduction to Python Programming"
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
              disabled={generateMutation.isPending}
            />
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Target Audience <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.target_audience}
              onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
              placeholder="e.g., Beginners with no programming experience"
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
              disabled={generateMutation.isPending}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Duration <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g., 8 weeks"
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                disabled={generateMutation.isPending}
              />
            </div>

            {/* Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Level <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                disabled={generateMutation.isPending}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            {/* Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Format <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.format}
                onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                disabled={generateMutation.isPending}
              >
                <option value="video">Video</option>
                <option value="text">Text</option>
                <option value="mixed">Mixed</option>
                <option value="workshop">Workshop</option>
              </select>
            </div>
          </div>

          {/* Learning Goals (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Learning Goals (Optional)
            </label>
            <textarea
              value={formData.learning_goals}
              onChange={(e) => setFormData({ ...formData, learning_goals: e.target.value })}
              placeholder="Specific learning outcomes you want to achieve"
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
              disabled={generateMutation.isPending}
            />
          </div>

          {/* Prerequisites (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Prerequisites (Optional)
            </label>
            <input
              type="text"
              value={formData.prerequisites}
              onChange={(e) => setFormData({ ...formData, prerequisites: e.target.value })}
              placeholder="e.g., Basic computer skills, familiarity with internet"
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
              disabled={generateMutation.isPending}
            />
          </div>

          <div className="text-center">
            <button
              type="submit"
              disabled={generateMutation.isPending}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 transition-all transform hover:scale-105 shadow-lg"
            >
              {generateMutation.isPending ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating Course Outline...
                </span>
              ) : (
                'Generate Course Outline'
              )}
            </button>
          </div>
        </form>

        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Course Overview */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {result.courseTitle}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">{result.courseSummary}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="flex items-center space-x-2">
                  <ClockIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Duration: {result.duration}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <UserGroupIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Level: {result.level}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <BookOpenIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Format: {formData.format}
                  </span>
                </div>
              </div>
            </div>

            {/* Prerequisites & Learning Objectives */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Prerequisites */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-lg text-gray-900 dark:text-white mb-3 flex items-center">
                  <ClipboardDocumentListIcon className="h-5 w-5 mr-2 text-orange-500" />
                  Prerequisites
                </h4>
                {result.prerequisites.length > 0 ? (
                  <ul className="space-y-2">
                    {result.prerequisites.map((prereq, idx) => (
                      <li key={idx} className="flex items-start">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 dark:text-gray-300">{prereq}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No prerequisites required</p>
                )}
              </div>

              {/* Learning Objectives */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-lg text-gray-900 dark:text-white mb-3 flex items-center">
                  <LightBulbIcon className="h-5 w-5 mr-2 text-yellow-500" />
                  Learning Objectives
                </h4>
                <ul className="space-y-2">
                  {result.learningObjectives.map((objective, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-purple-600 dark:text-purple-400 font-semibold mr-2">
                        {idx + 1}.
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">{objective}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Export Button */}
            <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
              <div>
                <h3 className="font-semibold text-lg text-gray-800 dark:text-white">Course Modules</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {result.modules.length} modules with detailed lessons and activities
                </p>
              </div>
              <button
                onClick={exportOutline}
                className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 shadow-md"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Outline
              </button>
            </div>

            {/* Modules */}
            <div className="space-y-4">
              {result.modules.map((module) => (
                <motion.div
                  key={module.moduleNumber}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: module.moduleNumber * 0.05 }}
                  className="border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:border-purple-300 dark:hover:border-purple-600 transition-all shadow-sm hover:shadow-md"
                >
                  <button
                    onClick={() => toggleModule(module.moduleNumber)}
                    className="w-full px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 hover:from-gray-100 hover:to-gray-150 dark:hover:from-gray-700 dark:hover:to-gray-800 transition-all flex items-center justify-between text-left"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg">
                        <span className="font-bold text-purple-600 dark:text-purple-300">
                          {module.moduleNumber}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-lg">
                          {module.title}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Duration: {module.duration} • {module.lessons.length} lessons
                        </p>
                      </div>
                    </div>
                    <div className={`transform transition-transform ${expandedModules.has(module.moduleNumber) ? 'rotate-180' : ''}`}>
                      <ChevronDownIcon className="h-6 w-6 text-gray-400" />
                    </div>
                  </button>

                  {expandedModules.has(module.moduleNumber) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="p-6 bg-white dark:bg-gray-800 space-y-6"
                    >
                      {/* Module Objectives */}
                      <div>
                        <h5 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                          Module Objectives
                        </h5>
                        <ul className="space-y-1">
                          {module.objectives.map((obj, idx) => (
                            <li key={idx} className="flex items-start text-sm text-gray-600 dark:text-gray-400">
                              <span className="text-purple-500 mr-2">•</span>
                              {obj}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Lessons */}
                      <div>
                        <h5 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">
                          Lessons
                        </h5>
                        <div className="space-y-3">
                          {module.lessons.map((lesson, idx) => (
                            <div key={idx} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h6 className="font-medium text-gray-900 dark:text-white">
                                  {lesson.title}
                                </h6>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {lesson.duration}
                                </span>
                              </div>
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Topics: </span>
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {lesson.topics.join(', ')}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Activities: </span>
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {lesson.activities.join(', ')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Assignments */}
                      {module.assignments.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                            Assignments
                          </h5>
                          <div className="space-y-2">
                            {module.assignments.map((assignment, idx) => (
                              <div key={idx} className="flex items-start">
                                <DocumentTextIcon className="h-5 w-5 text-purple-500 mr-2 flex-shrink-0" />
                                <div>
                                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                                    {assignment.title}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {assignment.description} ({assignment.type})
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Assessment Strategy & Resources */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assessment Strategy */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
                  Assessment Strategy
                </h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Formative Assessments
                    </h5>
                    <ul className="space-y-1">
                      {result.assessmentStrategy.formative.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Summative Assessments
                    </h5>
                    <ul className="space-y-1">
                      {result.assessmentStrategy.summative.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Grading Approach
                    </h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {result.assessmentStrategy.grading}
                    </p>
                  </div>
                </div>
              </div>

              {/* Resources */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
                  Recommended Resources
                </h4>
                <div className="space-y-3">
                  {result.resources.map((resource, idx) => (
                    <div key={idx} className="border-l-4 border-purple-500 pl-4">
                      <h5 className="font-medium text-gray-900 dark:text-white">
                        {resource.title}
                      </h5>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {resource.type}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {resource.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default CourseOutlineCreator;