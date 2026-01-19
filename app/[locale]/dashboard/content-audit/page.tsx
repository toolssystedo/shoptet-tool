import { getTranslations } from "next-intl/server";
import { ContentAuditClient } from "./content-audit-client";

export async function generateMetadata() {
  const t = await getTranslations("contentAudit");
  return {
    title: t("pageTitle"),
  };
}

export default async function ContentAuditPage() {
  return <ContentAuditClient />;
}
