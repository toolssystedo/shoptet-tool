import { getTranslations } from "next-intl/server";
import { SiteAuditClient } from "./site-audit-client";

export async function generateMetadata() {
  const t = await getTranslations("siteAudit");
  return {
    title: t("pageTitle"),
  };
}

export default async function SiteAuditPage() {
  return <SiteAuditClient />;
}
