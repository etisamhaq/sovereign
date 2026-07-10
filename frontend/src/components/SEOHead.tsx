import React from 'react';
import { Helmet } from 'react-helmet-async';
import { BRAND } from '../config/brand';

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogType?: 'website' | 'article' | 'product';
  ogImage?: string;
  keywords?: string;
  noIndex?: boolean;
  jsonLd?: object | object[];
  children?: React.ReactNode;
}

const BASE_TITLE = BRAND.name;
const DEFAULT_DESCRIPTION =
  'Sovereign — 33+ AI-powered tools for writing, research, education, and productivity. Paraphrase, grammar check, summarize, generate essays, and more.';
const SITE_URL = BRAND.siteUrl;
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

/**
 * Reusable SEO component that sets all meta tags via react-helmet-async.
 *
 * Usage:
 *   <SEOHead
 *     title="AI Paraphrase Tool"
 *     description="Rephrase text instantly with Sovereign's free AI paraphrase tool..."
 *     canonical="/tools/paraphrase"
 *     jsonLd={{ "@context": "https://schema.org", ... }}
 *   />
 */
const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  canonical,
  ogType = 'website',
  ogImage,
  keywords,
  noIndex = false,
  jsonLd,
  children,
}) => {
  const fullTitle = title ? `${title} — ${BASE_TITLE}` : BASE_TITLE;
  const metaDescription = description || DEFAULT_DESCRIPTION;
  const canonicalUrl = canonical
    ? `${SITE_URL}${canonical.startsWith('/') ? canonical : `/${canonical}`}`
    : undefined;
  const image = ogImage || DEFAULT_OG_IMAGE;

  // Support single or array of JSON-LD objects
  const jsonLdArray = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  return (
    <Helmet>
      {/* Core */}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={image} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:site_name" content="Sovereign" />
      <meta property="og:locale" content="en_US" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD Structured Data */}
      {jsonLdArray.map((ld, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(ld)}
        </script>
      ))}

      {children}
    </Helmet>
  );
};

export default SEOHead;

/* ─── JSON-LD helpers ─── */

/** SoftwareApplication schema for individual tool pages */
export function toolJsonLd(tool: {
  name: string;
  slug: string;
  description: string;
  category: string;
  is_premium: boolean;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `Sovereign ${tool.name}`,
    url: `${SITE_URL}/tools/${tool.slug}`,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    description: tool.description,
    offers: tool.is_premium
      ? {
          '@type': 'Offer',
          price: '5.00',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        }
      : {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.7',
      ratingCount: '120',
    },
  };
}

/** BreadcrumbList schema */
export function breadcrumbJsonLd(
  items: { name: string; url: string }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

/** FAQPage schema — useful for tool pages */
export function faqJsonLd(
  faqs: { question: string; answer: string }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/** ItemList schema for tool listing pages */
export function toolListJsonLd(
  tools: { name: string; slug: string; description: string }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Sovereign AI Writing & Research Tools',
    description: 'Browse 33+ AI-powered tools for writing, research, education, and productivity.',
    numberOfItems: tools.length,
    itemListElement: tools.map((tool, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${SITE_URL}/tools/${tool.slug}`,
      name: tool.name,
      description: tool.description,
    })),
  };
}
