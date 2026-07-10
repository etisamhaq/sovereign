/**
 * Analytics service for tracking user behavior and events
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

interface EventParams {
  category?: string;
  label?: string;
  value?: number;
  [key: string]: any;
}

class AnalyticsService {
  private initialized = false;
  private userId: string | null = null;

  /**
   * Initialize Google Analytics
   */
  initialize(measurementId: string) {
    if (this.initialized || !measurementId) return;

    // Add Google Analytics script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: false, // We'll send page views manually
    });

    this.initialized = true;
  }

  /**
   * Set user ID for tracking
   */
  setUserId(userId: string | null) {
    this.userId = userId;
    if (userId && window.gtag) {
      window.gtag('config', process.env.REACT_APP_GA_TRACKING_ID!, {
        user_id: userId,
      });
    }
  }

  /**
   * Track page view
   */
  trackPageView(path: string, title?: string) {
    if (!window.gtag) return;

    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title || document.title,
      user_id: this.userId,
    });
  }

  /**
   * Track custom event
   */
  trackEvent(action: string, params?: EventParams) {
    if (!window.gtag) return;

    const { category, label, value, ...rest } = params || {};
    const payload: Record<string, any> = {
      ...rest,
      event_category: category || 'engagement',
      event_label: label,
      user_id: this.userId,
    };
    if (value !== undefined) {
      payload.value = value;
    }
    window.gtag('event', action, payload);
  }

  /**
   * Track tool usage
   */
  trackToolUsage(toolName: string, toolCategory: string) {
    this.trackEvent('tool_usage', {
      category: 'tools',
      label: toolName,
      tool_category: toolCategory,
    });
  }

  /**
   * Track conversion events
   */
  trackConversion(type: 'signup' | 'subscription' | 'payment', value?: number) {
    this.trackEvent(`conversion_${type}`, {
      category: 'conversion',
      value: value,
    });
  }

  /**
   * Track errors
   */
  trackError(error: string, fatal: boolean = false) {
    this.trackEvent('exception', {
      description: error,
      fatal: fatal,
    });
  }

  /**
   * Track timing
   */
  trackTiming(category: string, variable: string, value: number) {
    this.trackEvent('timing_complete', {
      name: variable,
      value: Math.round(value),
      event_category: category,
    });
  }

  /**
   * Track user engagement
   */
  trackEngagement(action: string, label?: string) {
    this.trackEvent(action, {
      category: 'engagement',
      label: label,
    });
  }
}

// Create singleton instance
export const analytics = new AnalyticsService();

// Initialize on load if GA tracking ID is available
if (process.env.REACT_APP_GA_TRACKING_ID) {
  analytics.initialize(process.env.REACT_APP_GA_TRACKING_ID);
}

/**
 * Hook to track page views
 */
export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    analytics.trackPageView(location.pathname);
  }, [location]);
};

/**
 * Hook to track component visibility
 */
export const useVisibilityTracking = (componentName: string) => {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            analytics.trackEvent('component_view', {
              category: 'ui',
              label: componentName,
            });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5 }
    );

    const element = document.querySelector(`[data-track="${componentName}"]`);
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [componentName]);
};