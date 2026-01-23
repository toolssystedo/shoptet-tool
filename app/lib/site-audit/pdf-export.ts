import { jsPDF } from 'jspdf';
import type { AuditReport } from './crawler';

// AI Analysis interface (matches API response)
export interface AIAnalysis {
  executiveSummary: string;
  linkAnalysis: string;
  performanceAnalysis: string;
  htmlAnalysis: string;
  configAnalysis: string;
  securityAnalysis: string;
  priorityActions: string[];
  longTermRecommendations: string[];
}

// Systedo Brand Color Palette
const COLORS = {
  primary: [0, 56, 49] as [number, number, number],        // Systedo Teal #003831
  primaryLight: [0, 77, 67] as [number, number, number],   // Lighter teal
  success: [16, 122, 87] as [number, number, number],      // Green (teal-tinted)
  warning: [217, 119, 6] as [number, number, number],      // Amber
  error: [185, 28, 28] as [number, number, number],        // Red
  dark: [51, 51, 51] as [number, number, number],          // #333333
  muted: [102, 102, 102] as [number, number, number],      // #666666
  light: [238, 238, 238] as [number, number, number],      // #eeeeee
  lightBg: [248, 250, 249] as [number, number, number],    // Very light teal-tinted
  white: [255, 255, 255] as [number, number, number],
};

function getScoreColor(score: number): [number, number, number] {
  if (score >= 90) return COLORS.success;
  if (score >= 70) return COLORS.warning;
  return COLORS.error;
}

function getScoreBgColor(score: number): [number, number, number] {
  if (score >= 90) return [209, 250, 229] as [number, number, number]; // Light green
  if (score >= 70) return [254, 243, 199] as [number, number, number]; // Light amber
  return [254, 226, 226] as [number, number, number]; // Light red
}

// Remove Czech diacritics for PDF compatibility
function removeDiacritics(text: string): string {
  const map: Record<string, string> = {
    'á': 'a', 'č': 'c', 'ď': 'd', 'é': 'e', 'ě': 'e', 'í': 'i',
    'ň': 'n', 'ó': 'o', 'ř': 'r', 'š': 's', 'ť': 't', 'ú': 'u',
    'ů': 'u', 'ý': 'y', 'ž': 'z',
    'Á': 'A', 'Č': 'C', 'Ď': 'D', 'É': 'E', 'Ě': 'E', 'Í': 'I',
    'Ň': 'N', 'Ó': 'O', 'Ř': 'R', 'Š': 'S', 'Ť': 'T', 'Ú': 'U',
    'Ů': 'U', 'Ý': 'Y', 'Ž': 'Z',
  };
  return text.replace(/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g, char => map[char] || char);
}

// Truncate URL for display
function truncateUrl(url: string, maxLength: number = 60): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
}

export async function exportAuditToPdf(report: AuditReport, translations: {
  title: string;
  scores: Record<string, string>;
  stats: Record<string, string>;
  sections: Record<string, string>;
}): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  // Add new page and reset Y position
  const addNewPage = () => {
    doc.addPage();
    currentY = margin;
  };

  // Check if we need a new page
  const ensureSpace = (neededHeight: number): boolean => {
    if (currentY + neededHeight > pageHeight - 20) {
      addNewPage();
      return true;
    }
    return false;
  };

  // ==================== PAGE 1: HEADER & SCORES ====================

  // Header background - Systedo brand teal
  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.rect(0, 0, pageWidth, 55, 'F');

  // Brand name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('SYSTEDO', margin, 15);

  // Title
  doc.setFontSize(24);
  doc.text('Technicky Audit Webu', margin, 30);

  // Site URL
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(report.siteUrl, margin, 42);

  // Date
  const dateStr = new Date(report.scannedAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.text(dateStr, pageWidth - margin - doc.getTextWidth(dateStr), 42);

  currentY = 65;

  // ===== OVERALL SCORE =====
  const overallScore = report.scores.overall;
  const scoreColor = getScoreColor(overallScore);
  const scoreBg = getScoreBgColor(overallScore);

  // Score box
  const scoreBoxWidth = 80;
  const scoreBoxHeight = 50;
  const scoreBoxX = (pageWidth - scoreBoxWidth) / 2;

  doc.setFillColor(scoreBg[0], scoreBg[1], scoreBg[2]);
  doc.roundedRect(scoreBoxX, currentY, scoreBoxWidth, scoreBoxHeight, 5, 5, 'F');

  // Score number
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  const scoreStr = overallScore.toString();
  doc.text(scoreStr, pageWidth / 2 - doc.getTextWidth(scoreStr) / 2, currentY + 28);

  // Score label
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  const overallText = 'CELKOVE SKORE';
  doc.text(overallText, pageWidth / 2 - doc.getTextWidth(overallText) / 2, currentY + 42);

  currentY += scoreBoxHeight + 20;

  // ===== CATEGORY SCORES =====
  const categories = [
    { label: 'Odkazy', value: report.scores.links },
    { label: 'Vykon', value: report.scores.performance },
    { label: 'HTML', value: report.scores.html },
    { label: 'Konfig.', value: report.scores.config },
    { label: 'Bezpec.', value: report.scores.security },
  ];

  const catBoxWidth = (contentWidth - 20) / 5;
  const catBoxHeight = 40;

  categories.forEach((cat, i) => {
    const x = margin + i * (catBoxWidth + 5);
    const color = getScoreColor(cat.value);
    const bg = getScoreBgColor(cat.value);

    // Background
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.roundedRect(x, currentY, catBoxWidth, catBoxHeight, 3, 3, 'F');

    // Score
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(color[0], color[1], color[2]);
    const val = cat.value.toString();
    doc.text(val, x + catBoxWidth / 2 - doc.getTextWidth(val) / 2, currentY + 18);

    // Label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text(cat.label, x + catBoxWidth / 2 - doc.getTextWidth(cat.label) / 2, currentY + 32);
  });

  currentY += catBoxHeight + 15;

  // ===== STATISTICS BAR =====
  doc.setFillColor(COLORS.light[0], COLORS.light[1], COLORS.light[2]);
  doc.roundedRect(margin, currentY, contentWidth, 25, 3, 3, 'F');

  const stats = [
    { label: 'Stranky', value: report.totalPages },
    { label: 'Odkazy', value: report.totalLinks },
    { label: 'Obrazky', value: report.totalImages },
    { label: 'Problemy', value: getTotalIssues(report) },
  ];

  const statWidth = contentWidth / 4;
  stats.forEach((stat, i) => {
    const x = margin + i * statWidth + statWidth / 2;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    const val = stat.value.toString();
    doc.text(val, x - doc.getTextWidth(val) / 2, currentY + 10);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text(stat.label, x - doc.getTextWidth(stat.label) / 2, currentY + 18);
  });

  currentY += 35;

  // ==================== ISSUES SECTIONS ====================

  // Links issues
  const linkIssues = [
    ...report.errors.pages404.map(i => ({ url: i.url, type: 'Stranka 404', severity: 'error' as const })),
    ...report.errors.internalLinks404.map(i => ({ url: i.url, type: 'Nefunkcni odkaz', severity: 'error' as const })),
    ...report.errors.brokenImages.map(i => ({ url: i.url, type: 'Nefunkcni obrazek', severity: 'warning' as const })),
    ...report.errors.externalLinks404.map(i => ({ url: i.url, type: 'Externi 404', severity: 'warning' as const })),
  ];

  if (linkIssues.length > 0) {
    currentY = addIssueSection(doc, 'Problemy s odkazy', linkIssues, currentY, margin, contentWidth, pageHeight, ensureSpace, addNewPage);
  }

  // Performance issues
  if (report.performance.length > 0) {
    const perfIssues = report.performance.map(i => ({
      url: i.url,
      type: getPerformanceLabel(i.type),
      severity: i.severity,
      details: i.details,
    }));
    currentY = addIssueSection(doc, 'Problemy s vykonem', perfIssues, currentY, margin, contentWidth, pageHeight, ensureSpace, addNewPage);
  }

  // HTML issues
  if (report.html.length > 0) {
    const htmlIssues = report.html.map(i => ({
      url: i.url,
      type: getHtmlLabel(i.type),
      severity: i.severity,
      details: i.details,
    }));
    currentY = addIssueSection(doc, 'HTML problemy', htmlIssues, currentY, margin, contentWidth, pageHeight, ensureSpace, addNewPage);
  }

  // Config issues
  if (report.config.length > 0) {
    const configIssues = report.config.map(i => ({
      url: i.url || report.siteUrl,
      type: getConfigLabel(i.type),
      severity: i.severity,
      details: i.details,
    }));
    currentY = addIssueSection(doc, 'Problemy s konfiguraci', configIssues, currentY, margin, contentWidth, pageHeight, ensureSpace, addNewPage);
  }

  // Security issues
  if (report.security.length > 0) {
    const securityIssues = report.security.map(i => ({
      url: i.url,
      type: getSecurityLabel(i.type),
      severity: i.severity,
      details: i.source || i.details,
    }));
    currentY = addIssueSection(doc, 'Bezpecnostni problemy', securityIssues, currentY, margin, contentWidth, pageHeight, ensureSpace, addNewPage);
  }

  // ==================== FOOTER ON ALL PAGES ====================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer line - brand color
    doc.setDrawColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    // Footer text
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.text('SYSTEDO', margin, pageHeight - 8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text('| www.systedo.cz', margin + 18, pageHeight - 8);
    doc.text(`Strana ${i} / ${totalPages}`, pageWidth - margin - 20, pageHeight - 8);
  }

  // Save
  const hostname = new URL(report.siteUrl).hostname.replace('www.', '');
  const fileName = `systedo-audit-${hostname}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

function addIssueSection(
  doc: jsPDF,
  title: string,
  issues: Array<{ url: string; type: string; severity: 'error' | 'warning'; details?: string }>,
  startY: number,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  ensureSpace: (h: number) => boolean,
  addNewPage: () => void
): number {
  let y = startY;

  // Ensure space for header
  if (ensureSpace(25)) {
    y = margin;
  }

  // Section header
  const headerColor = issues[0]?.severity === 'error' ? COLORS.error : COLORS.warning;
  doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
  doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`${title} (${issues.length})`, margin + 5, y + 8);

  y += 16;

  // Issues list (no limit - export all)
  for (const issue of issues) {
    const rowHeight = 14;

    // Check for page break
    if (y + rowHeight > pageHeight - 25) {
      addNewPage();
      y = margin;
    }

    // Row background
    doc.setFillColor(COLORS.light[0], COLORS.light[1], COLORS.light[2]);
    doc.roundedRect(margin, y, contentWidth, rowHeight - 2, 2, 2, 'F');

    // Severity indicator
    const severityColor = issue.severity === 'error' ? COLORS.error : COLORS.warning;
    doc.setFillColor(severityColor[0], severityColor[1], severityColor[2]);
    doc.roundedRect(margin + 2, y + 3, 3, rowHeight - 8, 1, 1, 'F');

    // Type
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.text(removeDiacritics(issue.type), margin + 8, y + 6);

    // URL
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    const urlText = truncateUrl(issue.url, 80);
    doc.text(urlText, margin + 8, y + 10);

    y += rowHeight;
  }

  y += 10;
  return y;
}

function getTotalIssues(report: AuditReport): number {
  return (
    report.errors.pages404.length +
    report.errors.internalLinks404.length +
    report.errors.brokenImages.length +
    report.errors.externalLinks404.length +
    report.performance.length +
    report.html.length +
    report.config.length +
    report.security.length
  );
}

function getPerformanceLabel(type: string): string {
  const labels: Record<string, string> = {
    too_many_js: 'Prilis mnoho JS souboru',
    too_many_css: 'Prilis mnoho CSS souboru',
    unoptimized_image: 'Neoptimalizovany obrazek',
    missing_lazy_loading: 'Chybi lazy loading',
    render_blocking_script: 'Blokovani vykreslovani',
    too_many_webfonts: 'Prilis mnoho fontu',
    large_page_size: 'Velka velikost stranky',
  };
  return labels[type] || type;
}

function getHtmlLabel(type: string): string {
  const labels: Record<string, string> = {
    invalid_html: 'Neplatne HTML',
    missing_h1: 'Chybi H1',
    duplicate_h1: 'Duplicitni H1',
    heading_hierarchy: 'Spatna hierarchie nadpisu',
    empty_link: 'Prazdny odkaz',
    missing_alt: 'Chybi atribut alt',
    deprecated_element: 'Zastaraly element',
    missing_title: 'Chybi title',
    missing_meta_description: 'Chybi meta popis',
  };
  return labels[type] || type;
}

function getConfigLabel(type: string): string {
  const labels: Record<string, string> = {
    missing_robots: 'Chybi robots.txt',
    invalid_robots: 'Neplatny robots.txt',
    missing_sitemap: 'Chybi sitemap',
    sitemap_404_urls: 'Sitemap obsahuje 404 URL',
    sitemap_redirects: 'Sitemap obsahuje presmerovani',
    outdated_sitemap: 'Zastarala sitemap',
    missing_favicon: 'Chybi favicon',
    missing_og_tags: 'Chybi Open Graph tagy',
    missing_twitter_cards: 'Chybi Twitter Cards',
  };
  return labels[type] || type;
}

function getSecurityLabel(type: string): string {
  const labels: Record<string, string> = {
    mixed_content: 'Smiseny obsah (HTTP/HTTPS)',
    no_https_redirect: 'Chybi HTTPS presmerovani',
    untrusted_scripts: 'Neduveryhodny skript',
    missing_csp: 'Chybi CSP hlavicka',
    missing_x_frame_options: 'Chybi X-Frame-Options',
  };
  return labels[type] || type;
}

// ==================== AI ANALYSIS EXPORT ====================

// Export PDF with AI analysis (analysis must be fetched from API first)
export async function exportAuditWithAIAnalysis(
  report: AuditReport,
  analysis: AIAnalysis
): Promise<void> {

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  const addNewPage = () => {
    doc.addPage();
    currentY = margin;
  };

  const ensureSpace = (neededHeight: number): boolean => {
    if (currentY + neededHeight > pageHeight - 25) {
      addNewPage();
      return true;
    }
    return false;
  };

  // Helper to add wrapped text
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number = 5): number => {
    const cleanText = removeDiacritics(text);
    const lines = doc.splitTextToSize(cleanText, maxWidth);
    for (const line of lines) {
      if (currentY + lineHeight > pageHeight - 25) {
        addNewPage();
      }
      doc.text(line, x, currentY);
      currentY += lineHeight;
    }
    return currentY;
  };

  // ==================== HEADER - Systedo Brand ====================
  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.rect(0, 0, pageWidth, 60, 'F');

  // Brand name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('SYSTEDO', margin, 15);

  // Title
  doc.setFontSize(22);
  doc.text('AI Analyza', margin, 32);

  // Subtitle
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Technicky Audit Webu', margin, 42);

  // Site URL & Date
  doc.setFontSize(10);
  doc.text(report.siteUrl, margin, 52);

  const dateStr = new Date(report.scannedAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.text(dateStr, pageWidth - margin - doc.getTextWidth(dateStr), 52);

  currentY = 70;

  // ==================== SCORES OVERVIEW ====================
  const scoreY = currentY;
  const scoreBoxWidth = 30;
  const categories = [
    { label: 'Celkem', value: report.scores.overall },
    { label: 'Odkazy', value: report.scores.links },
    { label: 'Vykon', value: report.scores.performance },
    { label: 'HTML', value: report.scores.html },
    { label: 'Konfig.', value: report.scores.config },
    { label: 'Bezpec.', value: report.scores.security },
  ];

  categories.forEach((cat, i) => {
    const x = margin + i * (scoreBoxWidth + 2);
    const bg = getScoreBgColor(cat.value);
    const color = getScoreColor(cat.value);

    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.roundedRect(x, scoreY, scoreBoxWidth, 22, 2, 2, 'F');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(color[0], color[1], color[2]);
    const val = cat.value.toString();
    doc.text(val, x + scoreBoxWidth / 2 - doc.getTextWidth(val) / 2, scoreY + 10);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text(cat.label, x + scoreBoxWidth / 2 - doc.getTextWidth(cat.label) / 2, scoreY + 18);
  });

  currentY = scoreY + 32;

  // ==================== EXECUTIVE SUMMARY ====================
  ensureSpace(40);

  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.roundedRect(margin, currentY, contentWidth, 10, 2, 2, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Shrnuti', margin + 5, currentY + 7);
  currentY += 15;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  addWrappedText(analysis.executiveSummary, margin, currentY, contentWidth, 5);
  currentY += 10;

  // ==================== ANALYSIS SECTIONS ====================
  // Colors complement Systedo teal brand
  const sections = [
    { title: 'Analyza odkazu', content: analysis.linkAnalysis, color: [0, 77, 67] as [number, number, number] },      // Lighter teal
    { title: 'Analyza vykonu', content: analysis.performanceAnalysis, color: [0, 95, 82] as [number, number, number] },  // Medium teal
    { title: 'Analyza HTML a SEO', content: analysis.htmlAnalysis, color: [0, 113, 97] as [number, number, number] },         // Light teal
    { title: 'Analyza konfigurace', content: analysis.configAnalysis, color: [0, 77, 67] as [number, number, number] },     // Lighter teal
    { title: 'Analyza bezpecnosti', content: analysis.securityAnalysis, color: [0, 56, 49] as [number, number, number] },        // Primary teal
  ];

  for (const section of sections) {
    ensureSpace(35);

    doc.setFillColor(section.color[0], section.color[1], section.color[2]);
    doc.roundedRect(margin, currentY, contentWidth, 8, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(section.title, margin + 4, currentY + 5.5);
    currentY += 12;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    addWrappedText(section.content, margin, currentY, contentWidth, 4.5);
    currentY += 8;
  }

  // ==================== PRIORITY ACTIONS ====================
  ensureSpace(50);

  // Priority actions use darker brand color with amber accent
  doc.setFillColor(COLORS.error[0], COLORS.error[1], COLORS.error[2]);
  doc.roundedRect(margin, currentY, contentWidth, 10, 2, 2, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Prioritni akce (Okamzite)', margin + 5, currentY + 7);
  currentY += 15;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  for (let i = 0; i < analysis.priorityActions.length; i++) {
    ensureSpace(15);

    // Number circle
    doc.setFillColor(COLORS.error[0], COLORS.error[1], COLORS.error[2]);
    doc.circle(margin + 4, currentY - 1, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text((i + 1).toString(), margin + 2.5, currentY + 0.5);

    // Action text
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.setFont('helvetica', 'normal');
    const actionLines = doc.splitTextToSize(removeDiacritics(analysis.priorityActions[i]), contentWidth - 15);
    for (const line of actionLines) {
      doc.text(line, margin + 12, currentY);
      currentY += 4.5;
    }
    currentY += 3;
  }

  currentY += 5;

  // ==================== LONG-TERM RECOMMENDATIONS ====================
  ensureSpace(50);

  // Long-term uses success color (teal-tinted green)
  doc.setFillColor(COLORS.success[0], COLORS.success[1], COLORS.success[2]);
  doc.roundedRect(margin, currentY, contentWidth, 10, 2, 2, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Dlouhodobe doporuceni', margin + 5, currentY + 7);
  currentY += 15;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  for (let i = 0; i < analysis.longTermRecommendations.length; i++) {
    ensureSpace(15);

    // Number circle
    doc.setFillColor(COLORS.success[0], COLORS.success[1], COLORS.success[2]);
    doc.circle(margin + 4, currentY - 1, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text((i + 1).toString(), margin + 2.5, currentY + 0.5);

    // Recommendation text
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.setFont('helvetica', 'normal');
    const recLines = doc.splitTextToSize(removeDiacritics(analysis.longTermRecommendations[i]), contentWidth - 15);
    for (const line of recLines) {
      doc.text(line, margin + 12, currentY);
      currentY += 4.5;
    }
    currentY += 3;
  }

  // ==================== STATISTICS SUMMARY ====================
  ensureSpace(40);

  doc.setFillColor(COLORS.light[0], COLORS.light[1], COLORS.light[2]);
  doc.roundedRect(margin, currentY, contentWidth, 30, 3, 3, 'F');

  const statItems = [
    { label: 'Skenovano str.', value: report.totalPages },
    { label: 'Odkazu', value: report.totalLinks },
    { label: 'Obrazku', value: report.totalImages },
    { label: 'Problemu', value: getTotalIssues(report) },
  ];

  const statColWidth = contentWidth / 4;
  statItems.forEach((stat, i) => {
    const x = margin + i * statColWidth + statColWidth / 2;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    const val = stat.value.toString();
    doc.text(val, x - doc.getTextWidth(val) / 2, currentY + 12);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text(stat.label, x - doc.getTextWidth(stat.label) / 2, currentY + 22);
  });

  // ==================== FOOTER ON ALL PAGES ====================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer line - brand color
    doc.setDrawColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    // Footer text
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.text('SYSTEDO', margin, pageHeight - 8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text('| AI Analyza (GPT-4o-mini)', margin + 18, pageHeight - 8);
    doc.text(`Strana ${i} / ${totalPages}`, pageWidth - margin - 20, pageHeight - 8);
  }

  // Save
  const hostname = new URL(report.siteUrl).hostname.replace('www.', '');
  const fileName = `systedo-ai-analysis-${hostname}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
