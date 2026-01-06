"use client";

import { useEnrichmentStore } from "@/lib/stores/enrichment-store";
import { cn } from "@/lib/utils";
import { Folder, FolderOpen, Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function CategoryTree() {
  const { categoryGroups, selectedCategory, setSelectedCategory } = useEnrichmentStore();

  const totalProducts = categoryGroups.reduce((sum, g) => sum + g.products.length, 0);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm">Kategorie</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {categoryGroups.length} kategorií, {totalProducts} produktů
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* All products option */}
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left",
              selectedCategory === null
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            <Package className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 truncate">Všechny produkty</span>
            <span className="text-xs opacity-70">{totalProducts}</span>
          </button>

          {/* Category list */}
          {categoryGroups.map((group) => {
            const isSelected = selectedCategory === group.categoryName;
            const Icon = isSelected ? FolderOpen : Folder;

            return (
              <button
                key={group.categoryName}
                onClick={() => setSelectedCategory(group.categoryName)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                  group.categoryName === "Bez kategorie" && "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 truncate">{group.categoryName}</span>
                <span className="text-xs opacity-70">{group.products.length}</span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
