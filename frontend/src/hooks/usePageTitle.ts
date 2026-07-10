import { useEffect } from 'react';

const BASE_TITLE = 'Sovereign';
const DEFAULT_DESCRIPTION = 'Sovereign — 33+ AI-powered tools for writing, education, productivity, and content creation. All for just $5/month.';

/**
 * Sets the document <title> and optional meta description when a page mounts.
 * Usage: usePageTitle('Dashboard', 'View your writing activity and analytics.')
 *        usePageTitle('Dashboard') → "Dashboard — Sovereign"
 *        usePageTitle() → "Sovereign"
 */
export function usePageTitle(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE_TITLE}` : BASE_TITLE;

    // Set or update meta description
    const metaDesc = description || DEFAULT_DESCRIPTION;
    let metaTag = document.querySelector('meta[name="description"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'description');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', metaDesc);

    return () => {
      document.title = BASE_TITLE;
      if (metaTag) {
        metaTag.setAttribute('content', DEFAULT_DESCRIPTION);
      }
    };
  }, [title, description]);
}
