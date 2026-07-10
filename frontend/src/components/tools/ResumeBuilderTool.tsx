import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import {
  ArrowPathIcon,
  DocumentTextIcon,
  LightBulbIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

interface ResumeBuilderToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const styleOptions = [
  { value: 'professional', label: '💼 Professional' },
  { value: 'creative', label: '🎨 Creative' },
  { value: 'technical', label: '⚙️ Technical' },
  { value: 'executive', label: '👔 Executive' },
  { value: 'entry_level', label: '🎓 Entry Level' },
];

interface ResumeResult {
  full_name: string;
  target_role: string;
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    period: string;
    bullets: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    year: string;
    details: string;
  }>;
  skills: {
    technical: string[];
    soft: string[];
    tools: string[];
  };
  tips: string[];
  ats_score: number;
  ats_suggestions: string[];
}

const ResumeBuilderTool: React.FC<ResumeBuilderToolProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [experience, setExperience] = useState('');
  const [education, setEducation] = useState('');
  const [skills, setSkills] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [style, setStyle] = useState('professional');
  const [result, setResult] = useState<ResumeResult | null>(null);

  const handleGenerate = async () => {
    if (!fullName.trim()) return toast.error('Please enter your name');
    if (!targetRole.trim()) return toast.error('Please enter a target role');
    if (!experience.trim()) return toast.error('Please enter your experience');

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{ result: ResumeResult; processing_time: number }>(
        '/tools/resume-builder/',
        {
          full_name: fullName,
          target_role: targetRole,
          experience,
          education,
          skills,
          job_description: jobDescription,
          style,
        }
      );
      setResult(response.result);
      toast.success(`Resume built in ${response.processing_time?.toFixed(1)}s!`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to build resume');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'docx' | 'markdown') => {
    if (!result) return;

    const sections = [
      { heading: 'Professional Summary', body: result.summary },
      ...result.experience.map((exp) => ({
        heading: `${exp.title} — ${exp.company} (${exp.period})`,
        body: exp.bullets.map((b) => `• ${b}`).join('\n'),
      })),
      ...result.education.map((edu) => ({
        heading: `${edu.degree} — ${edu.institution} (${edu.year})`,
        body: edu.details || '',
      })),
      {
        heading: 'Skills',
        body: [
          result.skills.technical?.length ? `Technical: ${result.skills.technical.join(', ')}` : '',
          result.skills.soft?.length ? `Soft Skills: ${result.skills.soft.join(', ')}` : '',
          result.skills.tools?.length ? `Tools: ${result.skills.tools.join(', ')}` : '',
        ].filter(Boolean).join('\n'),
      },
    ];

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/tools/export/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({
            format,
            title: `${result.full_name} — ${result.target_role}`,
            content: '',
            sections,
          }),
        }
      );
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'markdown' ? 'md' : format;
      a.download = `${result.full_name.replace(/\s+/g, '_')}_Resume.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Resume exported as ${format.toUpperCase()}!`);
    } catch {
      toast.error('Failed to export resume');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-2">
          <DocumentTextIcon className="h-8 w-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{tool.name}</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">{tool.description}</p>
      </div>

      {/* Form */}
      <div className="card space-y-5">
        {/* Style */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resume Style</label>
          <div className="flex flex-wrap gap-2">
            {styleOptions.map((s) => (
              <button
                key={s.value}
                onClick={() => setStyle(s.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  style === s.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
            <input type="text" className="input" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Role</label>
            <input type="text" className="input" placeholder="Senior Software Engineer" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Work Experience</label>
          <textarea className="input" rows={5} placeholder="Paste your work history or write a rough summary..." value={experience} onChange={(e) => setExperience(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Education</label>
          <textarea className="input" rows={2} placeholder="Your education background..." value={education} onChange={(e) => setEducation(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skills</label>
          <textarea className="input" rows={2} placeholder="Python, React, Leadership, Project Management..." value={skills} onChange={(e) => setSkills(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Target Job Description <span className="text-gray-400">(helps tailor your resume)</span>
          </label>
          <textarea className="input" rows={3} placeholder="Paste the job description you're applying to..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
        </div>

        <button onClick={handleGenerate} disabled={isProcessing} className="btn btn-primary flex items-center gap-2">
          {isProcessing ? (
            <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Building Resume...</>
          ) : (
            <><DocumentTextIcon className="h-5 w-5" /> Build My Resume</>
          )}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-6">
          {/* ATS Score */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">ATS Compatibility Score</h2>
              <span className={`text-3xl font-bold ${
                result.ats_score >= 80 ? 'text-green-600' : result.ats_score >= 60 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {result.ats_score}/100
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-3">
              <div
                className={`h-2.5 rounded-full ${
                  result.ats_score >= 80 ? 'bg-green-500' : result.ats_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${result.ats_score}%` }}
              />
            </div>
            {result.ats_suggestions?.length > 0 && (
              <ul className="space-y-1">
                {result.ats_suggestions.map((s, i) => (
                  <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                    <CheckCircleIcon className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" /> {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Resume Content */}
          <div className="card space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{result.full_name}</h2>
              <div className="flex gap-2">
                <button onClick={() => handleExport('pdf')} className="btn btn-outline btn-sm flex items-center gap-1">
                  <ArrowDownTrayIcon className="h-4 w-4" /> PDF
                </button>
                <button onClick={() => handleExport('docx')} className="btn btn-outline btn-sm flex items-center gap-1">
                  <ArrowDownTrayIcon className="h-4 w-4" /> DOCX
                </button>
                <button onClick={() => handleExport('markdown')} className="btn btn-outline btn-sm flex items-center gap-1">
                  <ArrowDownTrayIcon className="h-4 w-4" /> MD
                </button>
              </div>
            </div>
            <p className="text-primary-600 dark:text-primary-400 font-medium">{result.target_role}</p>

            {/* Summary */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Professional Summary</h3>
              <p className="text-gray-700 dark:text-gray-300">{result.summary}</p>
            </div>

            {/* Experience */}
            {result.experience?.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Experience</h3>
                <div className="space-y-4">
                  {result.experience.map((exp, i) => (
                    <div key={i} className="border-l-2 border-primary-300 dark:border-primary-700 pl-4">
                      <p className="font-semibold text-gray-900 dark:text-white">{exp.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{exp.company} • {exp.period}</p>
                      <ul className="mt-2 space-y-1">
                        {exp.bullets.map((b, j) => (
                          <li key={j} className="text-sm text-gray-700 dark:text-gray-300">• {b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {result.education?.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Education</h3>
                {result.education.map((edu, i) => (
                  <div key={i} className="mb-2">
                    <p className="font-semibold text-gray-900 dark:text-white">{edu.degree}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{edu.institution} • {edu.year}</p>
                    {edu.details && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{edu.details}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Skills */}
            {result.skills && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Skills</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {result.skills.technical?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Technical</p>
                      <div className="flex flex-wrap gap-1">
                        {result.skills.technical.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.skills.soft?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Soft Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {result.skills.soft.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.skills.tools?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tools</p>
                      <div className="flex flex-wrap gap-1">
                        {result.skills.tools.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tips */}
          {result.tips?.length > 0 && (
            <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <LightBulbIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-blue-800 dark:text-blue-200">Improvement Tips</h3>
              </div>
              <ul className="space-y-1">
                {result.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-blue-700 dark:text-blue-300">• {tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResumeBuilderTool;
