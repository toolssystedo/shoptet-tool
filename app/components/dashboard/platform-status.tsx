"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ExternalLink, AlertCircle, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlatformStatusData {
  platform: string;
  name: string;
  status: string;
  statusText: string | null;
  indicator: string | null;
  pageUrl: string;
  lastChecked: string | null;
  lastChanged?: string | null;
  error?: string;
}

interface StatusResponse {
  success: boolean;
  cached?: boolean;
  platforms: PlatformStatusData[];
  alerts?: { platform: string; previous: string; current: string }[];
  error?: string;
}

// Status indicator configurations
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  operational: {
    color: "text-green-500",
    bgColor: "bg-green-500",
    icon: CheckCircle2,
    label: "Operational",
  },
  degraded: {
    color: "text-yellow-500",
    bgColor: "bg-yellow-500",
    icon: AlertTriangle,
    label: "Degraded Performance",
  },
  partial_outage: {
    color: "text-orange-500",
    bgColor: "bg-orange-500",
    icon: AlertCircle,
    label: "Partial Outage",
  },
  major_outage: {
    color: "text-red-500",
    bgColor: "bg-red-500",
    icon: XCircle,
    label: "Major Outage",
  },
  unknown: {
    color: "text-gray-400",
    bgColor: "bg-gray-400",
    icon: AlertCircle,
    label: "Unknown",
  },
};

// Platform icons/logos (using first letter as placeholder)
const PLATFORM_ICONS: Record<string, string> = {
  wordpress: "W",
  shoptet: "S",
  shopify: "Sh",
  upgates: "U",
};

function StatusDot({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  return (
    <span className="relative flex h-3 w-3">
      {status === "operational" ? null : (
        <span
          className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            config.bgColor
          )}
        />
      )}
      <span className={cn("relative inline-flex rounded-full h-3 w-3", config.bgColor)} />
    </span>
  );
}

function PlatformCard({ platform }: { platform: PlatformStatusData }) {
  const config = STATUS_CONFIG[platform.status] || STATUS_CONFIG.unknown;
  const Icon = config.icon;

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "—";
    const date = new Date(isoString);
    return date.toLocaleTimeString("cs-CZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div className="flex items-center gap-3">
        {/* Platform icon placeholder */}
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center font-semibold text-primary">
          {PLATFORM_ICONS[platform.platform] || platform.name[0]}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium">{platform.name}</span>
            <a
              href={platform.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <span className="text-xs text-muted-foreground">
            {platform.statusText || config.label}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <span className="text-xs text-muted-foreground">
            {platform.lastChecked ? formatTime(platform.lastChecked) : "Nekontrolováno"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status={platform.status} />
          <Icon className={cn("h-4 w-4", config.color)} />
        </div>
      </div>
    </div>
  );
}

export function PlatformStatus() {
  const [platforms, setPlatforms] = useState<PlatformStatusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch cached statuses on mount
  useEffect(() => {
    fetchCachedStatus();
  }, []);

  const fetchCachedStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/status/check");
      const data: StatusResponse = await response.json();

      if (data.success) {
        setPlatforms(data.platforms);
        if (data.platforms[0]?.lastChecked) {
          setLastUpdated(new Date(data.platforms[0].lastChecked));
        }
      } else {
        setError(data.error || "Failed to fetch status");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    try {
      setRefreshing(true);
      setError(null);

      const response = await fetch("/api/status/check", {
        method: "POST",
      });
      const data: StatusResponse = await response.json();

      if (data.success) {
        setPlatforms(data.platforms);
        setLastUpdated(new Date());

        // Show alert notification if any
        if (data.alerts && data.alerts.length > 0) {
          // Could show a toast notification here
          console.log("Status alerts:", data.alerts);
        }
      } else {
        setError(data.error || "Failed to refresh status");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setRefreshing(false);
    }
  };

  // Calculate overall status
  const overallStatus = platforms.reduce((worst, p) => {
    const statusOrder = ["major_outage", "partial_outage", "degraded", "unknown", "operational"];
    const currentIndex = statusOrder.indexOf(p.status);
    const worstIndex = statusOrder.indexOf(worst);
    return currentIndex < worstIndex ? p.status : worst;
  }, "operational");

  const overallConfig = STATUS_CONFIG[overallStatus] || STATUS_CONFIG.unknown;
  const OverallIcon = overallConfig.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Status platforem</CardTitle>
            {!loading && (
              <Badge
                variant="outline"
                className={cn("gap-1", overallConfig.color)}
              >
                <OverallIcon className="h-3 w-3" />
                {overallStatus === "operational" ? "Vše v pořádku" : overallConfig.label}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshStatus}
            disabled={refreshing || loading}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Aktualizovat
          </Button>
        </div>
        <CardDescription>
          Stav externích služeb a platforem
          {lastUpdated && (
            <span className="ml-2 text-xs">
              (aktualizováno {lastUpdated.toLocaleTimeString("cs-CZ")})
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 rounded-lg bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {platforms.map((platform) => (
              <PlatformCard key={platform.platform} platform={platform} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
