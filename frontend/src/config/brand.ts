export const BRAND = {
  name: 'Sovereign',
  siteUrl: process.env.REACT_APP_SITE_URL || 'https://sovereign.com',
  bookCallUrl: process.env.REACT_APP_BOOK_CALL_URL || 'https://calendly.com',
  contactEmail: process.env.REACT_APP_CONTACT_EMAIL || 'support@sovereign.com',
  social: {
    linkedin: 'https://linkedin.com/company/sovereign',
    instagram: 'https://www.instagram.com/sovereign.tech',
  },
  polar: {
    proProductId: process.env.REACT_APP_POLAR_PRO_PRODUCT_ID || '',
    proPriceId: process.env.REACT_APP_POLAR_PRO_PRICE_ID || '',
  },
  pricing: {
    pro: {
      price: 5,
      period: 'month',
    },
  },
} as const;
