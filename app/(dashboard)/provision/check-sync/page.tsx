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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRegion } from "@/components/dashboard/dashboard-layout";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CheckSyncResponse } from "@/types/ops-api";

const deviceFormSchema = z.object({
  deviceMake: z.enum(["Yealink", "Polycom"], {
    message: "Device make is required",
  }),
  sipAccount: z.string().min(1, "SIP account is required"),
});

const locationFormSchema = z.object({
  locationId: z.string().min(1, "Location ID is required"),
});

const practiceFormSchema = z.object({
  practiceId: z.string().min(1, "Practice ID is required"),
});

type DeviceFormValues = z.infer<typeof deviceFormSchema>;
type LocationFormValues = z.infer<typeof locationFormSchema>;
type PracticeFormValues = z.infer<typeof practiceFormSchema>;

export default function CheckSyncPage() {
  const { region } = useRegion();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"device" | "location" | "practice" | "all-bifrost">("device");
  const [result, setResult] = useState<CheckSyncResponse | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<(() => void) | null>(null);

  const deviceForm = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues: {
      deviceMake: "Yealink",
      sipAccount: "",
    },
  });

  const locationForm = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      locationId: "",
    },
  });

  const practiceForm = useForm<PracticeFormValues>({
    resolver: zodResolver(practiceFormSchema),
    defaultValues: {
      practiceId: "",
    },
  });

  const onSubmit = async (data: DeviceFormValues | LocationFormValues | PracticeFormValues) => {
    setPendingSubmit(() => () => {
      performSubmit(data);
    });
    setShowConfirm(true);
  };

  const performSubmit = async (data: DeviceFormValues | LocationFormValues | PracticeFormValues) => {
    setIsLoading(true);
    setShowConfirm(false);

    try {
      let checkType: any = {};

      if (activeTab === "device") {
        const deviceData = data as DeviceFormValues;
        checkType = {
          device: {
            deviceMake: deviceData.deviceMake,
            sipAccount: deviceData.sipAccount,
          },
        };
      } else if (activeTab === "location") {
        const locationData = data as LocationFormValues;
        checkType = {
          location: {
            locationId: locationData.locationId,
          },
        };
      } else if (activeTab === "practice") {
        const practiceData = data as PracticeFormValues;
        checkType = {
          practice: {
            practiceId: practiceData.practiceId,
          },
        };
      } else if (activeTab === "all-bifrost") {
        checkType = {
          allBifrost: {
            confirm: true,
          },
        };
      }

      const response = await fetch(`/api/v1/${region}/check-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          checkType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to check sync");
      }

      setResult(result);
      toast.success("Sync check completed");
      // Reset all forms to default values
      deviceForm.reset({
        deviceMake: "Yealink",
        sipAccount: "",
      });
      locationForm.reset({
        locationId: "",
      });
      practiceForm.reset({
        practiceId: "",
      });
      // Reset active tab to device
      setActiveTab("device");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to check sync"
      );
      setResult(null);
    } finally {
      setIsLoading(false);
      setPendingSubmit(null);
    }
  };

  const handleAllBifrostSubmit = () => {
    setPendingSubmit(() => () => {
      performSubmit({} as any);
    });
    setShowConfirm(true);
  };

  return (
    <RouteProtection>
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Check Sync</h1>
        <p className="text-slate-400 mt-2">
          Check synchronization status for entities in {region} region
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sync Status Check</CardTitle>
          <CardDescription>
            Select entity type and enter details to check sync status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="device">Device</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
              <TabsTrigger value="practice">Practice</TabsTrigger>
              <TabsTrigger value="all-bifrost">All Bifrost</TabsTrigger>
            </TabsList>

            <TabsContent value="device" className="space-y-4">
              <form onSubmit={deviceForm.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="deviceMake">Device Make</Label>
                  <select
                    id="deviceMake"
                    {...deviceForm.register("deviceMake")}
                    className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    disabled={isLoading}
                  >
                    <option value="Yealink">Yealink</option>
                    <option value="Polycom">Polycom</option>
                  </select>
                  {deviceForm.formState.errors.deviceMake && (
                    <p className="text-sm text-red-500">
                      {deviceForm.formState.errors.deviceMake.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sipAccount">SIP Account</Label>
                  <Input
                    id="sipAccount"
                    {...deviceForm.register("sipAccount")}
                    placeholder="Enter SIP account"
                    disabled={isLoading}
                  />
                  {deviceForm.formState.errors.sipAccount && (
                    <p className="text-sm text-red-500">
                      {deviceForm.formState.errors.sipAccount.message}
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Check Sync"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="location" className="space-y-4">
              <form onSubmit={locationForm.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="locationId">Location ID</Label>
                  <Input
                    id="locationId"
                    {...locationForm.register("locationId")}
                    placeholder="Enter Location ID"
                    disabled={isLoading}
                  />
                  {locationForm.formState.errors.locationId && (
                    <p className="text-sm text-red-500">
                      {locationForm.formState.errors.locationId.message}
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Check Sync"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="practice" className="space-y-4">
              <form onSubmit={practiceForm.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="practiceId">Practice ID</Label>
                  <Input
                    id="practiceId"
                    {...practiceForm.register("practiceId")}
                    placeholder="Enter Practice ID"
                    disabled={isLoading}
                  />
                  {practiceForm.formState.errors.practiceId && (
                    <p className="text-sm text-red-500">
                      {practiceForm.formState.errors.practiceId.message}
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Check Sync"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="all-bifrost" className="space-y-4">
              <div className="space-y-4">
                <div className="rounded-lg border border-yellow-800 bg-yellow-900/20 p-4">
                  <p className="text-sm text-yellow-200">
                    This will check all devices in Bifrost PROD. This operation may take some time.
                  </p>
                </div>
                <Button
                  onClick={handleAllBifrostSubmit}
                  disabled={isLoading}
                  className="w-full"
                  variant="destructive"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Check All Bifrost"
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {result && (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-center gap-2 mb-2">
                  {result.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="font-medium text-white">
                    {result.success ? "Check Completed" : "Check Failed"}
                  </span>
                </div>
                {result.message && (
                  <p className="text-sm text-slate-400 mb-4">{result.message}</p>
                )}
                {result.results && result.results.length > 0 && (
                  <div className="space-y-2">
                    {result.results.map((syncResult, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 rounded border border-slate-800 bg-slate-950 p-3"
                      >
                        {syncResult.inSync ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">
                            {syncResult.identifier}
                          </p>
                          <p className="text-xs text-slate-400">
                            {syncResult.inSync ? "In Sync" : "Not In Sync"}
                          </p>
                          {syncResult.details && (
                            <p className="text-xs text-slate-500 mt-1">
                              {syncResult.details}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Operation</DialogTitle>
            <DialogDescription>
              You are about to check sync status in the <strong>{region}</strong>{" "}
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
