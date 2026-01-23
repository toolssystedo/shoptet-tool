import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { AuditReport } from '@/lib/site-audit/crawler';

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

export async function POST(request: NextRequest) {
  try {
    const report: AuditReport = await request.json();

    if (!report || !report.siteUrl) {
      return NextResponse.json({ error: 'Invalid report data' }, { status: 400 });
    }

    const reportSummary = {
      siteUrl: report.siteUrl,
      totalPages: report.totalPages,
      totalLinks: report.totalLinks,
      totalImages: report.totalImages,
      scores: report.scores,
      issues: {
        pages404: report.errors.pages404.length,
        internalLinks404: report.errors.internalLinks404.length,
        brokenImages: report.errors.brokenImages.length,
        externalLinks404: report.errors.externalLinks404.length,
        performance: report.performance.length,
        html: report.html.length,
        config: report.config.length,
        security: report.security.length,
      },
      topIssues: {
        links: report.errors.pages404.slice(0, 5).map(i => i.url),
        brokenLinks: report.errors.internalLinks404.slice(0, 5).map(i => ({ url: i.url, source: i.source })),
        performance: report.performance.slice(0, 5).map(i => ({ type: i.type, url: i.url, details: i.details })),
        html: report.html.slice(0, 5).map(i => ({ type: i.type, url: i.url, details: i.details })),
        config: report.config.slice(0, 5).map(i => ({ type: i.type, details: i.details })),
        security: report.security.slice(0, 5).map(i => ({ type: i.type, source: i.source })),
      },
    };

    const prompt = `Jsi profesionalni expert na SEO a webovy vyvoj. Analyzuj tuto technicku auditni zpravu webu a poskytni podrobne poznatky.

AUDITNI ZPRAVA:
${JSON.stringify(reportSummary, null, 2)}

INTERPRETACE SKORE:
- 90-100: Vyborne
- 70-89: Dobre, ale vyzaduje pozornost
- 50-69: Vyzaduje vyrazne zlepseni
- Pod 50: Kriticke problemy

Poskytni analyzu v nasledujicim JSON formatu (VSECHNY TEXTY PISTE V CESTINE):
{
  "executiveSummary": "2-3 vety shrnujici celkovy stav webu a nejkritictejsi problemy",
  "linkAnalysis": "Analyza nefunkcnich odkazu, stranek 404 a problemu se strukturou odkazu. Co to znamena pro uzivatelskou zkusenost a SEO?",
  "performanceAnalysis": "Analyza problemu s vykonem. Jak tyto problemy ovlivnuji rychlost nacitani a uzivatelskou zkusenost?",
  "htmlAnalysis": "Analyza HTML/SEO problemu. Dopad na optimalizaci pro vyhledavace a pristupnost",
  "configAnalysis": "Analyza problemu s konfiguraci (robots.txt, sitemap atd.). Dopad na indexovani vyhledavaci",
  "securityAnalysis": "Analyza bezpecnostnich problemu. Potencialni rizika a doporuceni",
  "priorityActions": ["Pole 3-5 okamzitych akci k provedeni, serazene podle dulezitosti"],
  "longTermRecommendations": ["Pole 3-5 dlouhodobych zlepseni ke zvazeni"]
}

Bud konkretni a akcni. Odkazuj na skutecna cisla ze zpravy. Kazda sekce analyzy by mela mit 2-4 vety.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    const analysis: AIAnalysis = JSON.parse(content);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('AI Analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
