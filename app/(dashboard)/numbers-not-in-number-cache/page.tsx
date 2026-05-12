"use client";

import { useState } from "react";
import { RouteProtection } from "@/components/route-protection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRegion } from "@/components/dashboard/dashboard-layout";
import { toast } from "sonner";
import { Loader2, Download, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GetNumbersNotInNumberCacheResponse, PhoneNumberList } from "@/types/ops-api";

interface NumberRow {
  practiceId: string;
  phoneNumber: string;
}

export default function NumbersNotInNumberCachePage() {
  const { region } = useRegion();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GetNumbersNotInNumberCacheResponse | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<(() => void) | null>(null);

  const performSubmit = async () => {
    setIsLoading(true);
    setShowConfirm(false);

    try {
      const response = await fetch(`/api/v1/${region}/numbers-not-in-number-cache`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch numbers");
      }

      setResult(result);
      const practiceNumbers = result.practiceNumbers || {};
      const totalNumbers = (Object.values(practiceNumbers) as PhoneNumberList[]).reduce(
        (sum: number, list: PhoneNumberList) => sum + (list.phoneNumbers?.length || 0),
        0
      );
      toast.success(
        `Found ${totalNumbers} numbers across ${Object.keys(result.practiceNumbers || {}).length} practices`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch numbers"
      );
      setResult(null);
    } finally {
      setIsLoading(false);
      setPendingSubmit(null);
    }
  };

  const handleSubmit = () => {
    setPendingSubmit(() => () => {
      performSubmit();
    });
    setShowConfirm(true);
  };

  // Flatten the practiceNumbers map into rows for the table
  const numberRows: NumberRow[] = result?.practiceNumbers
    ? Object.entries(result.practiceNumbers).flatMap(([practiceId, phoneNumberList]) =>
        (phoneNumberList.phoneNumbers || []).map((phoneNumber) => ({
          practiceId,
          phoneNumber,
        }))
      )
    : [];

  const exportToCSV = () => {
    if (numberRows.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Practice ID", "Phone Number"];
    const rows = numberRows.map((row) => [row.practiceId, row.phoneNumber]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `numbers-not-in-cache-${region}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success("CSV exported successfully");
  };

  return (
    <RouteProtection>
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Numbers Not in Number Cache</h1>
        <p className="text-slate-400 mt-2">
          Check all Bifrost practices for numbers not in number cache in {region} region
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Number Cache Check</CardTitle>
          <CardDescription>
            This will check all Bifrost practices for numbers not in the number cache. No input required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check All Practices
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Results</CardTitle>
                <CardDescription>
                  {result.success
                    ? `Found ${numberRows.length} number${numberRows.length !== 1 ? "s" : ""} across ${Object.keys(result.practiceNumbers || {}).length} practice${Object.keys(result.practiceNumbers || {}).length !== 1 ? "s" : ""}`
                    : result.message}
                </CardDescription>
              </div>
              {numberRows.length > 0 && (
                <Button onClick={exportToCSV} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export to CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {result.message && !result.success && (
              <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 p-4">
                <p className="text-sm text-red-200">{result.message}</p>
              </div>
            )}
            {numberRows.length > 0 ? (
              <div className="rounded-md border border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Practice ID</TableHead>
                      <TableHead>Phone Number</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Skeleton className="h-4 w-32" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-32" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      numberRows.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {row.practiceId}
                          </TableCell>
                          <TableCell>{row.phoneNumber}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : result.success ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
                <p className="text-sm text-slate-400">No numbers found</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Operation</DialogTitle>
            <DialogDescription>
              You are about to check all Bifrost practices for numbers not in number cache in the{" "}
              <strong>{region}</strong> region. This operation may take some time. Do you want to
              continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirm(false);
                setPendingSubmit(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingSubmit) {
                  pendingSubmit();
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </RouteProtection>
  );
}
