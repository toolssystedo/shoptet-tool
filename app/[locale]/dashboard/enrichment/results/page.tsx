"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEnrichmentStore } from "@/lib/stores/enrichment-store";
import { ResultsEditor } from "./results-editor";

export default function ResultsPage() {
  const router = useRouter();
  const { enrichedData, parsedData } = useEnrichmentStore();

  // Redirect if no data
  useEffect(() => {
    if (enrichedData.length === 0 || !parsedData) {
      router.push("/dashboard/enrichment");
    }
  }, [enrichedData.length, parsedData, router]);

  if (enrichedData.length === 0 || !parsedData) {
    return null;
  }

  return <ResultsEditor />;
}
