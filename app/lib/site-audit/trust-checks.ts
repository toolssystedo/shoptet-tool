import * as cheerio from 'cheerio';

export interface TrustIssue {
  type:
    | 'missing_contact_page'
    | 'missing_contact_info'
    | 'missing_terms'
    | 'missing_privacy_policy'
    | 'missing_shipping_info'
    | 'missing_payment_info'
    | 'outdated_copyright'
    | 'missing_company_info'
    | 'missing_phone'
    | 'missing_email'
    | 'missing_address';
  url?: string;
  details?: string;
  severity: 'warning' | 'error';
}

export interface TrustAnalysis {
  hasContactPage: boolean;
  hasTermsPage: boolean;
  hasPrivacyPage: boolean;
  hasShippingInfo: boolean;
  hasPaymentInfo: boolean;
  copyrightYear: number | null;
  hasPhone: boolean;
  hasEmail: boolean;
  hasAddress: boolean;
  hasCompanyInfo: boolean;
}

// Check for important pages
export async function checkTrustPages(siteUrl: string): Promise<{ analysis: TrustAnalysis; issues: TrustIssue[] }> {
  const issues: TrustIssue[] = [];
  const baseUrl = new URL(siteUrl).origin;

  const analysis: TrustAnalysis = {
    hasContactPage: false,
    hasTermsPage: false,
    hasPrivacyPage: false,
    hasShippingInfo: false,
    hasPaymentInfo: false,
    copyrightYear: null,
    hasPhone: false,
    hasEmail: false,
    hasAddress: false,
    hasCompanyInfo: false,
  };

  // Common paths for important pages
  const contactPaths = ['/kontakt', '/contact', '/kontakty', '/contacts', '/kontakt.html'];
  const termsPaths = ['/obchodni-podminky', '/terms', '/vseobecne-obchodni-podminky', '/vop', '/terms-and-conditions'];
  const privacyPaths = ['/ochrana-osobnich-udaju', '/privacy', '/gdpr', '/privacy-policy', '/zasady-ochrany-osobnich-udaju'];
  const shippingPaths = ['/doprava', '/doprava-a-platba', '/shipping', '/delivery', '/doprava-platba'];

  // Check contact page
  for (const path of contactPaths) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteAuditBot/1.0)' },
      });
      if (response.ok) {
        analysis.hasContactPage = true;
        break;
      }
    } catch {
      // Continue
    }
  }

  if (!analysis.hasContactPage) {
    issues.push({
      type: 'missing_contact_page',
      severity: 'error',
      details: 'Nenalezena stránka s kontakty',
    });
  }

  // Check terms page
  for (const path of termsPaths) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteAuditBot/1.0)' },
      });
      if (response.ok) {
        analysis.hasTermsPage = true;
        break;
      }
    } catch {
      // Continue
    }
  }

  if (!analysis.hasTermsPage) {
    issues.push({
      type: 'missing_terms',
      severity: 'error',
      details: 'Nenalezeny obchodní podmínky',
    });
  }

  // Check privacy page
  for (const path of privacyPaths) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteAuditBot/1.0)' },
      });
      if (response.ok) {
        analysis.hasPrivacyPage = true;
        break;
      }
    } catch {
      // Continue
    }
  }

  if (!analysis.hasPrivacyPage) {
    issues.push({
      type: 'missing_privacy_policy',
      severity: 'warning',
      details: 'Nenalezena stránka o ochraně osobních údajů',
    });
  }

  // Check shipping/payment page
  for (const path of shippingPaths) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteAuditBot/1.0)' },
      });
      if (response.ok) {
        analysis.hasShippingInfo = true;
        analysis.hasPaymentInfo = true;
        break;
      }
    } catch {
      // Continue
    }
  }

  if (!analysis.hasShippingInfo) {
    issues.push({
      type: 'missing_shipping_info',
      severity: 'warning',
      details: 'Nenalezeny informace o dopravě',
    });
  }

  // Analyze homepage for contact info and copyright
  try {
    const response = await fetch(baseUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteAuditBot/1.0)' },
    });

    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);

      // Check footer for copyright year
      const footerText = $('footer').text();
      const copyrightMatch = footerText.match(/©\s*(\d{4})|copyright\s*(\d{4})/i);
      if (copyrightMatch) {
        analysis.copyrightYear = parseInt(copyrightMatch[1] || copyrightMatch[2]);
        const currentYear = new Date().getFullYear();
        if (analysis.copyrightYear < currentYear - 1) {
          issues.push({
            type: 'outdated_copyright',
            severity: 'warning',
            details: `Copyright rok ${analysis.copyrightYear} je zastaralý (aktuální rok: ${currentYear})`,
          });
        }
      }

      // Check for phone number
      const phoneRegex = /(\+?\d{3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3})|(\d{3}[\s-]?\d{3}[\s-]?\d{3})/;
      if (phoneRegex.test(html)) {
        analysis.hasPhone = true;
      }

      // Check for email
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      if (emailRegex.test(html)) {
        analysis.hasEmail = true;
      }

      // Check for address indicators
      const addressIndicators = ['ulice', 'ul.', 'street', 'adresa', 'sídlo', 'PSČ', 'zip'];
      if (addressIndicators.some(ind => html.toLowerCase().includes(ind.toLowerCase()))) {
        analysis.hasAddress = true;
      }

      // Check for company info (IČO, DIČ)
      const companyRegex = /IČO?:?\s*\d{8}|DIČ:?\s*[A-Z]{2}\d+/i;
      if (companyRegex.test(html)) {
        analysis.hasCompanyInfo = true;
      }
    }
  } catch {
    // Continue
  }

  // Add issues for missing contact info
  if (!analysis.hasPhone && !analysis.hasEmail) {
    issues.push({
      type: 'missing_contact_info',
      severity: 'warning',
      details: 'Na hlavní stránce chybí kontaktní informace (telefon nebo email)',
    });
  }

  if (!analysis.hasCompanyInfo) {
    issues.push({
      type: 'missing_company_info',
      severity: 'warning',
      details: 'Na stránce chybí firemní údaje (IČO, DIČ)',
    });
  }

  return { analysis, issues };
}

export function calculateTrustScore(analysis: TrustAnalysis): number {
  let score = 100;

  if (!analysis.hasContactPage) score -= 20;
  if (!analysis.hasTermsPage) score -= 20;
  if (!analysis.hasPrivacyPage) score -= 10;
  if (!analysis.hasShippingInfo) score -= 10;
  if (!analysis.hasPhone && !analysis.hasEmail) score -= 15;
  if (!analysis.hasCompanyInfo) score -= 10;
  if (analysis.copyrightYear && analysis.copyrightYear < new Date().getFullYear() - 1) score -= 5;

  return Math.max(0, score);
}
