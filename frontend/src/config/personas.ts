/**
 * Persona-based tool discovery configuration.
 *
 * Each persona maps a user role to the tool slugs most relevant to them.
 * All tools remain available to all users — personas only affect
 * ordering, filtering, and recommendations in the UI.
 */

export interface Persona {
  id: string;
  label: string;
  emoji: string;
  tagline: string;
  description: string;
  color: string;            // Tailwind color name (blue, purple, etc.)
  toolSlugs: string[];      // Ordered by relevance to this persona
  workflows: Workflow[];
}

export interface Workflow {
  title: string;
  steps: string[];          // Tool display names in order
}

export const PERSONAS: Persona[] = [
  {
    id: 'student',
    label: 'Students',
    emoji: '🎓',
    tagline: 'Write better essays, ace exams & save hours on research',
    description: 'AI tools designed to help you study smarter — from essay writing and exam prep to research and citations.',
    color: 'blue',
    toolSlugs: [
      'essay-writer',
      'summarizer',
      'citation-generator',
      'flashcard-creator',
      'quiz-generator',
      'paraphrase',
      'grammar-check',
      'plagiarism-check',
      'research-assistant',
      'outline-generator',
      'course-outline-creator',
      'writing-improver',
      'cover-letter-writer',
      'document-analyzer',
    ],
    workflows: [
      {
        title: 'Essay Writing',
        steps: ['Outline Generator', 'Essay Writer', 'Grammar Check', 'Plagiarism Check', 'Citation Generator'],
      },
      {
        title: 'Exam Prep',
        steps: ['Text Summarizer', 'Flashcard Creator', 'Quiz Generator'],
      },
      {
        title: 'Research',
        steps: ['Research Assistant', 'Text Summarizer', 'Citation Generator'],
      },
    ],
  },
  {
    id: 'creator',
    label: 'Content Creators',
    emoji: '✍️',
    tagline: 'Create, optimize & repurpose content 10x faster',
    description: 'Everything you need to write blog posts, social media content, and marketing copy — powered by AI.',
    color: 'purple',
    toolSlugs: [
      'paraphrase',
      'writing-improver',
      'title-generator',
      'social-media-generator',
      'content-repurposer',
      'meta-description-generator',
      'keyword-extractor',
      'linkedin-post-optimizer',
      'content-calendar',
      'grammar-check',
      'tone-analyzer',
      'summarizer',
      'blog-post-generator',
      'youtube-script-writer',
      'ad-copy-generator',
    ],
    workflows: [
      {
        title: 'Blog Writing',
        steps: ['Blog Post Generator', 'Writing Improver', 'Grammar Check', 'Meta Description Generator'],
      },
      {
        title: 'Social Media',
        steps: ['Social Media Generator', 'LinkedIn Optimizer', 'Tone Analyzer'],
      },
      {
        title: 'Content Repurposing',
        steps: ['Text Summarizer', 'Paraphraser', 'Content Repurposer'],
      },
    ],
  },
  {
    id: 'professional',
    label: 'Professionals',
    emoji: '💼',
    tagline: 'Communicate clearly & work smarter every day',
    description: 'AI tools for emails, resumes, reports, and business communication — so you sound polished in every message.',
    color: 'green',
    toolSlugs: [
      'email-writer',
      'resume-builder',
      'grammar-check',
      'tone-analyzer',
      'writing-improver',
      'linkedin-post-optimizer',
      'paraphrase',
      'summarizer',
      'translator',
      'title-generator',
      'cover-letter-writer',
      'ad-copy-generator',
      'blog-post-generator',
    ],
    workflows: [
      {
        title: 'Job Applications',
        steps: ['Resume Builder', 'Cover Letter Writer', 'LinkedIn Optimizer', 'Email Writer'],
      },
      {
        title: 'Business Writing',
        steps: ['Writing Improver', 'Tone Analyzer', 'Grammar Check'],
      },
      {
        title: 'Multilingual Work',
        steps: ['Translator', 'Grammar Check', 'Paraphraser'],
      },
    ],
  },
  {
    id: 'researcher',
    label: 'Researchers',
    emoji: '🔬',
    tagline: 'Analyze papers, cite sources & write faster',
    description: 'Speed up your literature reviews, draft papers with proper citations, and summarize findings — all with AI.',
    color: 'orange',
    toolSlugs: [
      'research-assistant',
      'summarizer',
      'citation-generator',
      'plagiarism-check',
      'paraphrase',
      'outline-generator',
      'grammar-check',
      'writing-improver',
      'translator',
      'document-analyzer',
    ],
    workflows: [
      {
        title: 'Literature Review',
        steps: ['Research Assistant', 'Text Summarizer', 'Citation Generator'],
      },
      {
        title: 'Paper Writing',
        steps: ['Outline Generator', 'Writing Improver', 'Plagiarism Check', 'Citation Generator'],
      },
      {
        title: 'Cross-Language Research',
        steps: ['Translator', 'Text Summarizer', 'Paraphraser'],
      },
    ],
  },
  {
    id: 'developer',
    label: 'Developers',
    emoji: '💻',
    tagline: 'Generate code, write docs & plan projects faster',
    description: 'AI-powered tools for code generation, technical documentation, README files, and project planning.',
    color: 'cyan',
    toolSlugs: [
      'code-generator',
      'writing-improver',
      'grammar-check',
      'summarizer',
      'paraphrase',
      'roadmap-builder',
      'title-generator',
      'document-analyzer',
    ],
    workflows: [
      {
        title: 'Code & Docs',
        steps: ['Code Generator', 'Writing Improver', 'Grammar Check'],
      },
      {
        title: 'Project Planning',
        steps: ['Roadmap Builder', 'Outline Generator', 'Summarizer'],
      },
      {
        title: 'Learning',
        steps: ['Code Generator', 'Flashcard Creator', 'Quiz Generator'],
      },
    ],
  },
];

/** Lookup a persona by its URL-safe id */
export const getPersonaById = (id: string): Persona | undefined =>
  PERSONAS.find((p) => p.id === id);

/** Get all tool slugs for a persona (for filtering) */
export const getPersonaToolSlugs = (personaId: string): string[] =>
  getPersonaById(personaId)?.toolSlugs ?? [];

/** Tailwind color classes per persona color name */
export const personaColors: Record<string, { bg: string; text: string; border: string; badge: string; gradient: string }> = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-600 dark:text-blue-400',     border: 'border-blue-200 dark:border-blue-800',     badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',     gradient: 'from-blue-500 to-cyan-500' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/20',   text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800', badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300', gradient: 'from-purple-500 to-pink-500' },
  green:  { bg: 'bg-green-50 dark:bg-green-900/20',     text: 'text-green-600 dark:text-green-400',   border: 'border-green-200 dark:border-green-800',   badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',   gradient: 'from-green-500 to-emerald-500' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-900/20',   text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800', badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300', gradient: 'from-orange-500 to-amber-500' },
  cyan:   { bg: 'bg-cyan-50 dark:bg-cyan-900/20',       text: 'text-cyan-600 dark:text-cyan-400',     border: 'border-cyan-200 dark:border-cyan-800',     badge: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',     gradient: 'from-cyan-500 to-blue-500' },
};
