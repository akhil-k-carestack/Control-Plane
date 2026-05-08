"use client";

import { useState } from "react";
import { RouteProtection } from "@/components/route-protection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AppLogsPage() {
  const [agentuuid, setAgentuuid] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    const trimmed = agentuuid.trim();
    if (!trimmed) {
      toast.error("agentuuid is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/common-utilities/app-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentuuid: trimmed }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        data?: { documentId?: string };
      };

      if (!response.ok) {
        throw new Error(result.error || "Failed to create app log");
      }

      toast.success(result.message || "App log created successfully");
      setAgentuuid("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create app log");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RouteProtection>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">App Logs</h1>
          <p className="text-slate-400 mt-2">
            Upload app logs by agent UUID
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload App Log</CardTitle>
            <CardDescription>
              Enter an <code>agentuuid</code> to upload app logs to S3
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agentuuid">Agent UUID</Label>
              <Input
                id="agentuuid"
                value={agentuuid}
                onChange={(e) => setAgentuuid(e.target.value)}
                placeholder="e.g. a786eec5-47e4-4c40-bd2a-2a2a9aac9721"
                disabled={isSubmitting}
              />
            </div>
            <Button onClick={handleCreate} disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Upload App Log"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </RouteProtection>
  );
}
