import { getTranslations } from "next-intl/server";
import { MiniToolsClient } from "./mini-tools-client";

export async function generateMetadata() {
  const t = await getTranslations("miniTools");
  return {
    title: t("pageTitle"),
  };
}

export default async function MiniToolsPage() {
  return <MiniToolsClient />;
}
