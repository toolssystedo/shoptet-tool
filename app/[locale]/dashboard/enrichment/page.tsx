import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { EnrichmentWizard } from "./components/enrichment-wizard";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function EnrichmentPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const t = await getTranslations("enrichment");

  if (!session?.user) {
    redirect({ href: "/auth/signin", locale });
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("description")}
        </p>
      </div>
      <EnrichmentWizard />
    </div>
  );
}
