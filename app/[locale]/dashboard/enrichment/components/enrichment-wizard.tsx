"use client";

import { useEnrichmentStore } from "@/lib/stores/enrichment-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Upload, Settings, Loader2 } from "lucide-react";
import { StepUpload } from "./step-upload";
import { StepConfiguration } from "./step-configuration";
import { StepProcessing } from "./step-processing";
import { useTranslations } from "next-intl";

const steps = [
  { id: 1, titleKey: "steps.upload", icon: Upload },
  { id: 2, titleKey: "steps.configure", icon: Settings },
  { id: 3, titleKey: "steps.process", icon: Loader2 },
];

export function EnrichmentWizard() {
  const { currentStep, setStep, reset } = useEnrichmentStore();
  const t = useTranslations("enrichment");
  const tCommon = useTranslations("common");

  const canNavigateToStep = (stepId: number) => {
    // Can always go back
    if (stepId < currentStep) return true;
    // Can only go forward one step at a time
    return stepId === currentStep;
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <nav className="flex items-center justify-center">
        <ol className="flex items-center space-x-2 md:space-x-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            const isClickable = canNavigateToStep(step.id);

            return (
              <li key={step.id} className="flex items-center">
                <button
                  onClick={() => isClickable && setStep(step.id as 1 | 2 | 3)}
                  disabled={!isClickable}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                    isActive && "bg-primary text-primary-foreground",
                    isCompleted && "bg-primary/20 text-primary",
                    !isActive && !isCompleted && "text-muted-foreground",
                    isClickable && !isActive && "hover:bg-muted cursor-pointer",
                    !isClickable && "cursor-not-allowed opacity-50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2",
                      isActive && "border-primary-foreground",
                      isCompleted && "border-primary bg-primary text-primary-foreground",
                      !isActive && !isCompleted && "border-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="hidden md:inline font-medium">{t(step.titleKey)}</span>
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-8 md:w-16 h-0.5 mx-2",
                      currentStep > step.id ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      <Card>
        <CardContent className="pt-6">
          {currentStep === 1 && <StepUpload />}
          {currentStep === 2 && <StepConfiguration />}
          {currentStep === 3 && <StepProcessing />}
        </CardContent>
      </Card>

      {/* Reset button */}
      {currentStep > 1 && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={reset}>
            {tCommon("reset")}
          </Button>
        </div>
      )}
    </div>
  );
}
