import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Platform configurations with their status page endpoints
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

// Timeout for fetch requests (10 seconds)
const FETCH_TIMEOUT = 10000;

interface StatusPageResponse {
  status: {
    indicator: string; // none, minor, major, critical
    description: string;
  };
  page?: {
    name: string;
    url: string;
  };
}

/**
 * Parse RSS feed and extract status information
 * StatusIQ RSS format: <description>Service Name is [Status]</description>
 * Possible statuses: Operational, Degraded Performance, Partial Outage, Major Outage, Under Maintenance
 */
function parseRssStatus(rssText: string): { status: string; description: string } {
  // Extract all description tags content
  const descriptionMatches = rssText.match(/<description>([^<]+)<\/description>/gi) || [];

  let operationalCount = 0;
  let degradedCount = 0;
  let partialOutageCount = 0;
  let majorOutageCount = 0;
  let maintenanceCount = 0;

  for (const desc of descriptionMatches) {
    const content = desc.replace(/<\/?description>/gi, "").toLowerCase();

    // Parse status from "Service is [Status]" format
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

  const totalServices = operationalCount + degradedCount + partialOutageCount + majorOutageCount + maintenanceCount;

  // Determine overall status based on service statuses
  if (majorOutageCount > 0) {
    return {
      status: "major_outage",
      description: `Major Outage (${majorOutageCount} services affected)`,
    };
  }

  if (partialOutageCount > 0) {
    return {
      status: "partial_outage",
      description: `Partial Outage (${partialOutageCount} services affected)`,
    };
  }

  if (degradedCount > 0 || maintenanceCount > 0) {
    return {
      status: "degraded",
      description: `Degraded (${degradedCount + maintenanceCount} services affected)`,
    };
  }

  if (operationalCount > 0) {
    return {
      status: "operational",
      description: "All Systems Operational",
    };
  }

  // Fallback if no status found
  return {
    status: "unknown",
    description: "Unable to determine status",
  };
}

interface PlatformStatusResult {
  platform: string;
  name: string;
  status: string;
  statusText: string;
  indicator: string;
  pageUrl: string;
  lastChecked?: string;
  error?: string;
}

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(
  url: string,
  timeout: number,
  accept: string = "application/json"
): Promise<Response> {
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
 * Fetch status from a platform's status page (JSON or RSS)
 */
async function fetchPlatformStatus(platform: (typeof PLATFORMS)[0]): Promise<PlatformStatusResult> {
  try {
    const acceptHeader = platform.type === "rss" ? "application/rss+xml, application/xml, text/xml" : "application/json";
    const response = await fetchWithTimeout(platform.statusUrl, FETCH_TIMEOUT, acceptHeader);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Handle RSS feed
    if (platform.type === "rss") {
      const rssText = await response.text();
      const rssStatus = parseRssStatus(rssText);

      // Map to standard status format
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

    // Handle JSON (Atlassian Statuspage format)
    const data: StatusPageResponse = await response.json();

    // Map indicator to user-friendly status
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
    // If fetch fails, return error status
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      platform: platform.id,
      name: platform.name,
      status: "unknown",
      statusText: "Unable to fetch status",
      indicator: "unknown",
      pageUrl: platform.pageUrl,
      error: errorMessage,
    };
  }
}

/**
 * Placeholder function for sending outage email notifications
 * Connect to your email provider (Resend/SendGrid/Nodemailer) later
 */
async function sendOutageEmail(
  platformName: string,
  newStatus: string,
  previousStatus: string
): Promise<void> {
  // TODO: Implement email sending with your preferred provider
  // Example with Resend:
  // await resend.emails.send({
  //   from: 'alerts@yourdomain.com',
  //   to: users.map(u => u.email),
  //   subject: `[Alert] ${platformName} Status Changed`,
  //   html: `<p>${platformName} status changed from ${previousStatus} to ${newStatus}</p>`
  // });

  console.log(
    `[EMAIL ALERT] Platform: ${platformName}, Status: ${previousStatus} → ${newStatus}`
  );

  // Fetch all user emails for notification
  try {
    const users = await prisma.user.findMany({
      where: { email: { not: null } },
      select: { email: true, name: true },
    });

    console.log(`Would send alert to ${users.length} users:`, users.map((u) => u.email));
  } catch (error) {
    console.error("Failed to fetch users for email notification:", error);
  }
}

/**
 * Check if status change warrants an alert
 * Alert when going from operational/degraded to partial_outage/major_outage
 */
function shouldSendAlert(previousStatus: string | null, newStatus: string): boolean {
  const criticalStatuses = ["partial_outage", "major_outage"];
  const normalStatuses = ["operational", "degraded", "unknown"];

  // Alert if transitioning from normal to critical
  if (
    (!previousStatus || normalStatuses.includes(previousStatus)) &&
    criticalStatuses.includes(newStatus)
  ) {
    return true;
  }

  return false;
}

/**
 * POST /api/status/check
 * Fetches current status of all platforms, compares with DB, triggers alerts if needed
 */
export async function POST(request: NextRequest) {
  try {
    const results: PlatformStatusResult[] = [];
    const alerts: { platform: string; previous: string; current: string }[] = [];

    // Fetch all platform statuses in parallel
    const statusPromises = PLATFORMS.map((platform) => fetchPlatformStatus(platform));
    const statuses = await Promise.all(statusPromises);

    // Current timestamp for all checks
    const checkTime = new Date();

    // Process each status
    for (const status of statuses) {
      // Get previous status from database
      const previousRecord = await prisma.platformStatus.findUnique({
        where: { platform: status.platform },
      });

      const previousStatus = previousRecord?.status || null;
      const statusChanged = previousStatus !== status.status;

      // Check if we need to send an alert
      if (statusChanged && shouldSendAlert(previousStatus, status.status)) {
        alerts.push({
          platform: status.name,
          previous: previousStatus || "unknown",
          current: status.status,
        });

        // Send email notification
        await sendOutageEmail(status.name, status.status, previousStatus || "unknown");
      }

      // Update database with new status
      await prisma.platformStatus.upsert({
        where: { platform: status.platform },
        create: {
          platform: status.platform,
          status: status.status,
          statusText: status.statusText,
          indicator: status.indicator,
          lastChecked: checkTime,
          lastChanged: statusChanged ? checkTime : null,
        },
        update: {
          status: status.status,
          statusText: status.statusText,
          indicator: status.indicator,
          lastChecked: checkTime,
          ...(statusChanged && { lastChanged: checkTime }),
        },
      });

      // Add to results with lastChecked
      results.push({
        ...status,
        lastChecked: checkTime.toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      platforms: results,
      alerts: alerts.length > 0 ? alerts : undefined,
    });
  } catch (error) {
    console.error("Platform status check error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/status/check
 * Returns cached statuses from database without fetching new data
 */
export async function GET(request: NextRequest) {
  try {
    const statuses = await prisma.platformStatus.findMany({
      orderBy: { platform: "asc" },
    });

    // If no statuses in DB, return platform list with unknown status
    if (statuses.length === 0) {
      return NextResponse.json({
        success: true,
        cached: false,
        platforms: PLATFORMS.map((p) => ({
          platform: p.id,
          name: p.name,
          status: "unknown",
          statusText: "Not yet checked",
          indicator: "unknown",
          pageUrl: p.pageUrl,
          lastChecked: null,
        })),
      });
    }

    // Map DB records to response format
    const platformMap = new Map(PLATFORMS.map((p) => [p.id, p]));
    const results = statuses.map((s) => ({
      platform: s.platform,
      name: platformMap.get(s.platform)?.name || s.platform,
      status: s.status,
      statusText: s.statusText,
      indicator: s.indicator,
      pageUrl: platformMap.get(s.platform)?.pageUrl || "",
      lastChecked: s.lastChecked.toISOString(),
      lastChanged: s.lastChanged?.toISOString() || null,
    }));

    return NextResponse.json({
      success: true,
      cached: true,
      platforms: results,
    });
  } catch (error) {
    console.error("Get platform status error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
