import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Cron job endpoint for automatic platform status checking
 * Called by Vercel Cron every 5 minutes
 *
 * Security: Vercel automatically adds CRON_SECRET header
 * https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
 */

// Platform configurations
const PLATFORMS = [
  {
    id: "wordpress",
    name: "WordPress",
    statusUrl: "https://automatticstatus.com/rss",
    type: "rss" as const,
    pageUrl: "https://automatticstatus.com/",
  },
  {
    id: "shoptet",
    name: "Shoptet",
    statusUrl: "https://www.shoptetstatus.com/api/v2/status.json",
    type: "json" as const,
    pageUrl: "https://www.shoptetstatus.com/",
  },
  {
    id: "shopify",
    name: "Shopify",
    statusUrl: "https://www.shopifystatus.com/api/v2/status.json",
    type: "json" as const,
    pageUrl: "https://www.shopifystatus.com/",
  },
  {
    id: "upgates",
    name: "UpGates",
    statusUrl: "https://status.linode.com/api/v2/status.json",
    type: "json" as const,
    pageUrl: "https://www.upgates.cz/a/status",
  },
];

const FETCH_TIMEOUT = 10000;

interface StatusPageResponse {
  status: {
    indicator: string;
    description: string;
  };
}

interface PlatformStatusResult {
  platform: string;
  name: string;
  status: string;
  statusText: string;
  indicator: string;
  pageUrl: string;
  error?: string;
}

/**
 * Parse RSS feed status (StatusIQ format)
 */
function parseRssStatus(rssText: string): { status: string; description: string } {
  const descriptionMatches = rssText.match(/<description>([^<]+)<\/description>/gi) || [];

  let operationalCount = 0;
  let degradedCount = 0;
  let partialOutageCount = 0;
  let majorOutageCount = 0;
  let maintenanceCount = 0;

  for (const desc of descriptionMatches) {
    const content = desc.replace(/<\/?description>/gi, "").toLowerCase();

    if (content.includes(" is operational")) {
      operationalCount++;
    } else if (content.includes(" is degraded") || content.includes("degraded performance")) {
      degradedCount++;
    } else if (content.includes("partial outage")) {
      partialOutageCount++;
    } else if (content.includes("major outage")) {
      majorOutageCount++;
    } else if (content.includes("maintenance") || content.includes("under maintenance")) {
      maintenanceCount++;
    }
  }

  if (majorOutageCount > 0) {
    return { status: "major_outage", description: `Major Outage (${majorOutageCount} services)` };
  }
  if (partialOutageCount > 0) {
    return { status: "partial_outage", description: `Partial Outage (${partialOutageCount} services)` };
  }
  if (degradedCount > 0 || maintenanceCount > 0) {
    return { status: "degraded", description: `Degraded (${degradedCount + maintenanceCount} services)` };
  }
  if (operationalCount > 0) {
    return { status: "operational", description: "All Systems Operational" };
  }
  return { status: "unknown", description: "Unable to determine status" };
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, timeout: number, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PlatformStatusMonitor/1.0",
        Accept: accept,
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Fetch platform status
 */
async function fetchPlatformStatus(platform: (typeof PLATFORMS)[0]): Promise<PlatformStatusResult> {
  try {
    const acceptHeader = platform.type === "rss"
      ? "application/rss+xml, application/xml, text/xml"
      : "application/json";

    const response = await fetchWithTimeout(platform.statusUrl, FETCH_TIMEOUT, acceptHeader);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (platform.type === "rss") {
      const rssText = await response.text();
      const rssStatus = parseRssStatus(rssText);
      const indicatorMap: Record<string, string> = {
        operational: "none",
        degraded: "minor",
        partial_outage: "major",
        major_outage: "critical",
      };

      return {
        platform: platform.id,
        name: platform.name,
        status: rssStatus.status,
        statusText: rssStatus.description,
        indicator: indicatorMap[rssStatus.status] || "unknown",
        pageUrl: platform.pageUrl,
      };
    }

    const data: StatusPageResponse = await response.json();
    const statusMap: Record<string, string> = {
      none: "operational",
      minor: "degraded",
      major: "partial_outage",
      critical: "major_outage",
    };

    return {
      platform: platform.id,
      name: platform.name,
      status: statusMap[data.status.indicator] || "unknown",
      statusText: data.status.description,
      indicator: data.status.indicator,
      pageUrl: platform.pageUrl,
    };
  } catch (error) {
    return {
      platform: platform.id,
      name: platform.name,
      status: "unknown",
      statusText: "Unable to fetch status",
      indicator: "unknown",
      pageUrl: platform.pageUrl,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send outage email notification (placeholder)
 */
async function sendOutageEmail(platformName: string, newStatus: string, previousStatus: string): Promise<void> {
  console.log(`[CRON EMAIL ALERT] ${platformName}: ${previousStatus} → ${newStatus}`);

  try {
    const users = await prisma.user.findMany({
      where: { email: { not: null } },
      select: { email: true, name: true },
    });
    console.log(`Would send alert to ${users.length} users`);
  } catch (error) {
    console.error("Failed to fetch users for notification:", error);
  }
}

/**
 * Check if alert should be sent
 */
function shouldSendAlert(previousStatus: string | null, newStatus: string): boolean {
  const criticalStatuses = ["partial_outage", "major_outage"];
  const normalStatuses = ["operational", "degraded", "unknown"];

  return (
    (!previousStatus || normalStatuses.includes(previousStatus)) &&
    criticalStatuses.includes(newStatus)
  );
}

/**
 * GET /api/status/cron
 * Vercel Cron endpoint - runs every 5 minutes
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel adds this automatically)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // In production, verify the secret
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log("[CRON] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[CRON] Starting platform status check...");

  try {
    const alerts: { platform: string; previous: string; current: string }[] = [];

    // Fetch all statuses in parallel
    const statuses = await Promise.all(PLATFORMS.map(fetchPlatformStatus));

    // Process each status
    for (const status of statuses) {
      const previousRecord = await prisma.platformStatus.findUnique({
        where: { platform: status.platform },
      });

      const previousStatus = previousRecord?.status || null;
      const statusChanged = previousStatus !== status.status;

      // Check for alerts
      if (statusChanged && shouldSendAlert(previousStatus, status.status)) {
        alerts.push({
          platform: status.name,
          previous: previousStatus || "unknown",
          current: status.status,
        });
        await sendOutageEmail(status.name, status.status, previousStatus || "unknown");
      }

      // Update database
      await prisma.platformStatus.upsert({
        where: { platform: status.platform },
        create: {
          platform: status.platform,
          status: status.status,
          statusText: status.statusText,
          indicator: status.indicator,
          lastChecked: new Date(),
          lastChanged: statusChanged ? new Date() : null,
        },
        update: {
          status: status.status,
          statusText: status.statusText,
          indicator: status.indicator,
          lastChecked: new Date(),
          ...(statusChanged && { lastChanged: new Date() }),
        },
      });
    }

    console.log(`[CRON] Completed. Alerts: ${alerts.length}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      checked: statuses.length,
      alerts: alerts.length > 0 ? alerts : undefined,
    });
  } catch (error) {
    console.error("[CRON] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
