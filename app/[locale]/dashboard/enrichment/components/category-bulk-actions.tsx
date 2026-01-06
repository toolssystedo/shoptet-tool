"use client";

import { useMemo, useState } from "react";
import { useEnrichmentStore } from "@/lib/stores/enrichment-store";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Trash2, Filter, FileText, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function CategoryBulkActions() {
  const { categoryGroups, selectedCategory, bulkRemoveParam } = useEnrichmentStore();

  const [selectedFilteringParams, setSelectedFilteringParams] = useState<Set<string>>(new Set());
  const [selectedTextParams, setSelectedTextParams] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "filtering" | "text";
    params: string[];
  } | null>(null);

  // Get current category group
  const currentGroup = useMemo(() => {
    if (!selectedCategory) return null;
    return categoryGroups.find((g) => g.categoryName === selectedCategory) || null;
  }, [categoryGroups, selectedCategory]);

  if (!currentGroup) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Vyberte kategorii pro hromadné úpravy</p>
      </div>
    );
  }

  const { filtering, text } = currentGroup.commonParams;

  const toggleFilteringParam = (param: string) => {
    const newSet = new Set(selectedFilteringParams);
    if (newSet.has(param)) {
      newSet.delete(param);
    } else {
      newSet.add(param);
    }
    setSelectedFilteringParams(newSet);
  };

  const toggleTextParam = (param: string) => {
    const newSet = new Set(selectedTextParams);
    if (newSet.has(param)) {
      newSet.delete(param);
    } else {
      newSet.add(param);
    }
    setSelectedTextParams(newSet);
  };

  const handleDeleteFiltering = () => {
    if (selectedFilteringParams.size === 0) return;
    setPendingAction({
      type: "filtering",
      params: Array.from(selectedFilteringParams),
    });
    setShowConfirmDialog(true);
  };

  const handleDeleteText = () => {
    if (selectedTextParams.size === 0) return;
    setPendingAction({
      type: "text",
      params: Array.from(selectedTextParams),
    });
    setShowConfirmDialog(true);
  };

  const confirmDelete = () => {
    if (!pendingAction || !selectedCategory) return;

    for (const param of pendingAction.params) {
      bulkRemoveParam(selectedCategory, pendingAction.type, param);
    }

    // Clear selections
    if (pendingAction.type === "filtering") {
      setSelectedFilteringParams(new Set());
    } else {
      setSelectedTextParams(new Set());
    }

    setPendingAction(null);
    setShowConfirmDialog(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-sm mb-1">Hromadné akce</h3>
        <p className="text-xs text-muted-foreground">
          Kategorie: <Badge variant="outline">{selectedCategory}</Badge>
          <span className="ml-2">({currentGroup.products.length} produktů)</span>
        </p>
      </div>

      {/* Filtering parameters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Filtrační parametry
          </Label>
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedFilteringParams.size === 0}
            onClick={handleDeleteFiltering}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Smazat ({selectedFilteringParams.size})
          </Button>
        </div>
        <ScrollArea className="h-[120px] border rounded-md p-2">
          {filtering.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Žádné filtrační parametry
            </p>
          ) : (
            <div className="space-y-1">
              {filtering.map((param) => (
                <div key={param} className="flex items-center gap-2">
                  <Checkbox
                    id={`filtering-${param}`}
                    checked={selectedFilteringParams.has(param)}
                    onCheckedChange={() => toggleFilteringParam(param)}
                  />
                  <Label
                    htmlFor={`filtering-${param}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {param}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Text parameters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Textové parametry
          </Label>
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedTextParams.size === 0}
            onClick={handleDeleteText}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Smazat ({selectedTextParams.size})
          </Button>
        </div>
        <ScrollArea className="h-[120px] border rounded-md p-2">
          {text.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Žádné textové parametry
            </p>
          ) : (
            <div className="space-y-1">
              {text.map((param) => (
                <div key={param} className="flex items-center gap-2">
                  <Checkbox
                    id={`text-${param}`}
                    checked={selectedTextParams.has(param)}
                    onCheckedChange={() => toggleTextParam(param)}
                  />
                  <Label
                    htmlFor={`text-${param}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {param}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potvrdit smazání</AlertDialogTitle>
            <AlertDialogDescription>
              Opravdu chcete smazat {pendingAction?.params.length} parametr(ů) ze všech{" "}
              {currentGroup.products.length} produktů v kategorii &quot;{selectedCategory}&quot;?
              <br />
              <br />
              Tato akce nelze vrátit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
