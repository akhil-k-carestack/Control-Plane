"use client";

import { useState } from "react";
import { RouteProtection } from "@/components/route-protection";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useRegion } from "@/components/dashboard/dashboard-layout";
import { toast } from "sonner";
import { Loader2, Copy, Check, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GenerateSignedURLResponse } from "@/types/ops-api";

const formSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .url("Please enter a valid URL")
    .refine(
      (url) => {
        // Basic validation for S3 URLs or recording URLs
        return (
          url.startsWith("https://") ||
          url.startsWith("http://") ||
          url.includes("s3") ||
          url.includes("recording")
        );
      },
      {
        message: "URL should be a valid S3 or recording URL",
      }
    ),
});

type FormValues = z.infer<typeof formSchema>;

export default function GenerateSignedURLPage() {
  const { region } = useRegion();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GenerateSignedURLResponse | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<(() => void) | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setPendingSubmit(() => () => {
      performSubmit(data);
    });
    setShowConfirm(true);
  };

  const performSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setShowConfirm(false);

    try {
      const response = await fetch(`/api/v1/${region}/generate-signed-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: data.url,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate signed URL");
      }

      setResult(result);
      toast.success("Signed URL generated successfully");
      // Reset form to default values
      reset({
        url: "",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate signed URL"
      );
      setResult(null);
    } finally {
      setIsLoading(false);
      setPendingSubmit(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const formatExpiryTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <RouteProtection>
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Generate Signed URL</h1>
        <p className="text-slate-400 mt-2">
          Generate a signed URL for S3 recording URLs in {region} region
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recording URL</CardTitle>
          <CardDescription>
            Enter the S3 recording URL to generate a signed URL (valid for 3 hours)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">Recording URL</Label>
              <Input
                id="url"
                type="url"
                {...register("url")}
                placeholder="https://s3.amazonaws.com/bucket/recording.mp3"
                disabled={isLoading}
                className="font-mono text-sm"
              />
              {errors.url && (
                <p className="text-sm text-red-500">{errors.url.message}</p>
              )}
              <p className="text-xs text-slate-500">
                Enter a valid S3 URL or recording URL
              </p>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Signed URL"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && result.success && result.signedUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Signed URL</CardTitle>
            <CardDescription>
              URL is valid for {formatExpiryTime(result.expiresIn || 10800)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Signed URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={result.signedUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(result.signedUrl!)}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(result.signedUrl!, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {result.message && (
              <p className="text-sm text-slate-400">{result.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {result && !result.success && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-400">{result.message}</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Operation</DialogTitle>
            <DialogDescription>
              You are about to generate a signed URL in the <strong>{region}</strong>{" "}
              region. Do you want to continue?
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

