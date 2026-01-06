"use client";

import type { ProductRow, EnrichedRow } from "@/lib/enrichment/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface PreviewComparisonProps {
  originalRows: ProductRow[];
  enrichedRows: EnrichedRow[];
}

export function PreviewComparison({
  originalRows,
  enrichedRows,
}: PreviewComparisonProps) {
  return (
    <div className="space-y-6">
      {enrichedRows.map((enrichedRow, index) => {
        const originalRow = originalRows[index];
        const hasError = !!enrichedRow.error;
        const hasResults =
          enrichedRow.aiResult &&
          (enrichedRow.aiResult.filtering.length > 0 ||
            enrichedRow.aiResult.text.length > 0);

        return (
          <Card key={index} className={hasError ? "border-destructive/50" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {hasError ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                Row {originalRow.rowIndex + 1}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Original Data */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Source Text
                </h4>
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  {originalRow.shortDescription && (
                    <div className="mb-2">
                      <span className="font-medium">Short Description: </span>
                      <span className="text-muted-foreground">
                        {String(originalRow.shortDescription).substring(0, 200)}
                        {String(originalRow.shortDescription).length > 200 && "..."}
                      </span>
                    </div>
                  )}
                  {originalRow.description && (
                    <div>
                      <span className="font-medium">Description: </span>
                      <span className="text-muted-foreground">
                        {String(originalRow.description).substring(0, 300)}
                        {String(originalRow.description).length > 300 && "..."}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {hasError && (
                <div className="bg-destructive/10 rounded-lg p-3">
                  <p className="text-sm text-destructive">{enrichedRow.error}</p>
                </div>
              )}

              {/* Extracted Data */}
              {hasResults && (
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Filtering Properties */}
                  {enrichedRow.aiResult!.filtering.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Filtering Properties
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8">Property</TableHead>
                            <TableHead className="h-8">Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {enrichedRow.aiResult!.filtering.map((prop, i) => (
                            <TableRow key={i}>
                              <TableCell className="py-2 font-medium">
                                {prop.name}
                              </TableCell>
                              <TableCell className="py-2">
                                <Badge variant="secondary">{prop.value}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Text Properties */}
                  {enrichedRow.aiResult!.text.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Text Properties
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8">Key</TableHead>
                            <TableHead className="h-8">Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {enrichedRow.aiResult!.text.map((prop, i) => (
                            <TableRow key={i}>
                              <TableCell className="py-2 font-medium">
                                {prop.key}
                              </TableCell>
                              <TableCell className="py-2">
                                <span className="text-sm">{prop.value}</span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* No Results */}
              {!hasError && !hasResults && (
                <div className="bg-muted/50 rounded-lg p-3 text-center text-muted-foreground text-sm">
                  No attributes extracted from this row
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
