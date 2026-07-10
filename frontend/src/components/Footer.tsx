import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    Product: [
      { name: 'Compliance Audit', href: '/compliance' },
      { name: 'Features', href: '/features' },
      { name: 'Tools', href: '/tools' },
      { name: 'Pricing', href: '/pricing' },
    ],
    Company: [
      { name: 'About', href: '/about' },
      { name: 'Blog', href: '/blog' },
      { name: 'Contact', href: '/contact' },
    ],
    Legal: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
    ],
  };

  return (
    <footer className="bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand + tagline */}
          <div className="md:col-span-1">
            <div className="flex items-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
                <ShieldCheckIcon className="h-5 w-5" />
              </span>
              <span className="ml-2 font-display text-lg font-semibold text-white">
                Sovereign
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-gray-400">
              Private compliance auditing for GDPR, HIPAA, and SOC 2 — running on your own
              AMD Instinct GPUs. Your documents never leave your infrastructure.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-3">
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                  {category}
                </h3>
                <ul className="mt-4 space-y-2">
                  {links.map((link) => (
                    <li key={link.name}>
                      <Link to={link.href} className="text-sm text-gray-300 hover:text-white">
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t border-gray-800 pt-8 text-center text-sm text-gray-500">
          &copy; {currentYear} Sovereign. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
