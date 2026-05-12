"use client";

import { useState, useEffect, useRef } from "react";
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
import { Loader2, Search, Phone, Clock, Calendar, ChevronDown, Check, Copy, Download, ExternalLink } from "lucide-react";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/permissions";
import { hasPermissionFromSession } from "@/lib/permissions";
import { CallFlowTimeline } from "@/components/call-details/call-flow-timeline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Practice, CallDetails } from "@/types/ops-api";

const formSchema = z.object({
  practiceId: z.string().min(1, "Practice is required"),
  callId: z.string().min(1, "Call ID is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function CallDetailsPage() {
  const { region } = useRegion();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPractices, setIsLoadingPractices] = useState(true);
  const [isLoadingCompleteDetails, setIsLoadingCompleteDetails] = useState(false);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [callDetails, setCallDetails] = useState<CallDetails | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<(() => void) | null>(null);
  const [practiceSearchQuery, setPracticeSearchQuery] = useState("");
  const [isPracticeDropdownOpen, setIsPracticeDropdownOpen] = useState(false);
  const [recordingUrlCopied, setRecordingUrlCopied] = useState(false);
  const practiceInputRef = useRef<HTMLInputElement>(null);
  const practiceDropdownRef = useRef<HTMLDivElement>(null);

  // Check if user has permission to export call details
  const permissions = (session?.user as any)?.permissions || [];
  const role = (session?.user as any)?.role || null;
  const canExport = hasPermissionFromSession(permissions, role, PERMISSIONS.EXPORT_CALL_DETAILS);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      practiceId: "",
      callId: "",
    },
  });

  const practiceId = watch("practiceId");

  // Filter practices based on search query
  const filteredPractices = practices.filter((practice) =>
    practice.practiceName.toLowerCase().includes(practiceSearchQuery.toLowerCase()) ||
    practice.practiceId.toLowerCase().includes(practiceSearchQuery.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        practiceInputRef.current &&
        !practiceInputRef.current.contains(event.target as Node) &&
        practiceDropdownRef.current &&
        !practiceDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPracticeDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update search query when practiceId changes externally
  useEffect(() => {
    if (practiceId && practices.length > 0) {
      const practice = practices.find((p) => p.practiceId === practiceId);
      if (practice) {
        setPracticeSearchQuery(practice.practiceName);
      }
    } else if (!practiceId) {
      setPracticeSearchQuery("");
    }
  }, [practiceId, practices]);

  // Fetch practices on page load
  useEffect(() => {
    const fetchPractices = async () => {
      setIsLoadingPractices(true);
      try {
        const response = await fetch(`/api/v1/${region}/list-practices`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to fetch practices");
        }

        if (result.success && result.practices) {
          setPractices(result.practices);
        } else {
          toast.error(result.message || "Failed to fetch practices");
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to fetch practices"
        );
      } finally {
        setIsLoadingPractices(false);
      }
    };

    fetchPractices();
  }, [region]);

  const onSubmit = async (data: FormValues) => {
    setPendingSubmit(() => () => {
      performSubmit(data);
    });
    setShowConfirm(true);
  };

  const performSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setShowConfirm(false);
    setCallDetails(null);

    try {
      const response = await fetch(`/api/v1/${region}/get-call-details`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          practiceId: data.practiceId,
          callId: data.callId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to get call details");
      }

      if (result.success && result.callDetails) {
        setCallDetails(result.callDetails);
        toast.success("Call details retrieved successfully");
      } else {
        toast.error(result.message || "No call details found");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to get call details"
      );
    } finally {
      setIsLoading(false);
      setPendingSubmit(null);
    }
  };

  const selectedPractice = practices.find((p) => p.practiceId === practiceId);

  const handlePracticeSelect = (practice: Practice) => {
    setValue("practiceId", practice.practiceId);
    setPracticeSearchQuery(practice.practiceName);
    setIsPracticeDropdownOpen(false);
  };

  const handlePracticeInputChange = (value: string) => {
    setPracticeSearchQuery(value);
    setIsPracticeDropdownOpen(true);
    // If user clears the input, clear the selection
    if (!value) {
      setValue("practiceId", "");
    } else {
      // If user is typing and there's a match, we might want to auto-select
      // But for now, just filter
      const exactMatch = practices.find(
        (p) => p.practiceName.toLowerCase() === value.toLowerCase() ||
        p.practiceId.toLowerCase() === value.toLowerCase()
      );
      if (exactMatch && exactMatch.practiceId !== practiceId) {
        // Don't auto-select, let user choose
      }
    }
  };

  const handlePracticeInputFocus = () => {
    setIsPracticeDropdownOpen(true);
  };

  const handleCopyCompleteDetails = async () => {
    if (!callDetails) return;

    setIsLoadingCompleteDetails(true);
    try {
      const response = await fetch(`/api/v1/${region}/get-complete-call-details`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          callId: callDetails.callId,
          practiceId: callDetails.practiceId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to get complete call details");
      }

      if (result.success && result.callDetails) {
        // Build JSON object with both call history and lifecycle
        const completeData: any = {
          callId: result.callDetails.callId,
          practiceId: result.callDetails.practiceId,
        };

        if (result.callDetails.hasCallHistory && result.callDetails.callHistoryJson) {
          try {
            completeData.callHistory = JSON.parse(result.callDetails.callHistoryJson);
          } catch (e) {
            completeData.callHistory = result.callDetails.callHistoryJson;
          }
        }

        if (result.callDetails.hasCallLifecycle && result.callDetails.callLifecycleJson) {
          try {
            completeData.callLifecycle = JSON.parse(result.callDetails.callLifecycleJson);
          } catch (e) {
            completeData.callLifecycle = result.callDetails.callLifecycleJson;
          }
        }

        // Copy to clipboard
        const jsonString = JSON.stringify(completeData, null, 2);
        await navigator.clipboard.writeText(jsonString);
        toast.success("Complete call details copied to clipboard as JSON");
      } else {
        toast.error(result.message || "No complete call details found");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to get complete call details"
      );
    } finally {
      setIsLoadingCompleteDetails(false);
    }
  };

  const handleCopyRecordingUrl = async () => {
    if (!callDetails?.recordingUrl) return;

    try {
      await navigator.clipboard.writeText(callDetails.recordingUrl);
      setRecordingUrlCopied(true);
      toast.success("Recording URL copied to clipboard");
      setTimeout(() => setRecordingUrlCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy recording URL");
    }
  };

  return (
    <RouteProtection>
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Call Details Search</h1>
        <p className="text-slate-400 mt-2">
          Search for call details by Call ID and Practice in {region} region
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Call Details</CardTitle>
          <CardDescription>
            Select a practice and enter a Call ID to retrieve call information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2 relative">
              <Label htmlFor="practiceId">Practice</Label>
              <div className="relative">
                <Input
                  ref={practiceInputRef}
                  id="practiceId"
                  value={practiceSearchQuery}
                  onChange={(e) => handlePracticeInputChange(e.target.value)}
                  onFocus={handlePracticeInputFocus}
                  placeholder={isLoadingPractices ? "Loading practices..." : "Search or select a practice"}
                  disabled={isLoadingPractices || isLoading}
                  className="pr-10"
                />
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                
                {isPracticeDropdownOpen && !isLoadingPractices && practices.length > 0 && (
                  <div
                    ref={practiceDropdownRef}
                    className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border border-slate-700 bg-slate-900 shadow-lg"
                  >
                    {filteredPractices.length > 0 ? (
                      <div className="p-1">
                        {filteredPractices.map((practice) => (
                          <div
                            key={practice.practiceId}
                            onClick={() => handlePracticeSelect(practice)}
                            className={`
                              relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm
                              ${practiceId === practice.practiceId
                                ? "bg-slate-800 text-white"
                                : "text-slate-50 hover:bg-slate-800 hover:text-white"
                              }
                            `}
                          >
                            {practiceId === practice.practiceId && (
                              <Check className="mr-2 h-4 w-4" />
                            )}
                            <div className="flex flex-col">
                              <span className="font-medium">{practice.practiceName}</span>
                              <span className="text-xs text-slate-400">ID: {practice.practiceId}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-400">
                        No practices found matching "{practiceSearchQuery}"
                      </div>
                    )}
                  </div>
                )}
              </div>
              {errors.practiceId && (
                <p className="text-sm text-red-500">
                  {errors.practiceId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="callId">Call ID</Label>
              <Input
                id="callId"
                {...register("callId")}
                placeholder="e.g., CA1234567890abcdef"
                disabled={isLoading}
              />
              {errors.callId && (
                <p className="text-sm text-red-500">
                  {errors.callId.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isLoading || isLoadingPractices} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Get Call Details
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {callDetails && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Call Details</CardTitle>
                <CardDescription>
                  Information for Call ID: {callDetails.callId}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {callDetails.grafanaUrl && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(callDetails.grafanaUrl, '_blank', 'noopener,noreferrer')}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View in Grafana
                  </Button>
                )}
                {canExport && (
                  <Button
                    variant="outline"
                    onClick={handleCopyCompleteDetails}
                    disabled={isLoadingCompleteDetails}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    {isLoadingCompleteDetails ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy from MongoDB
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Time Information Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <Calendar className="h-5 w-5 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-400">Call Time</p>
                  <p className="text-lg font-semibold text-white">
                    {new Date(callDetails.callTime).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <Calendar className="h-5 w-5 text-orange-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-400">Call End Time</p>
                  <p className="text-lg font-semibold text-white">
                    {callDetails.callEndTime 
                      ? new Date(callDetails.callEndTime).toLocaleString()
                      : "N/A"
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Duration and Numbers Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <Clock className="h-5 w-5 text-emerald-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-400">Conversation Duration</p>
                  <p className="text-lg font-semibold text-white">
                    {callDetails.conversationDuration} seconds
                    <span className="text-sm text-slate-400 ml-2">
                      ({Math.floor(callDetails.conversationDuration / 60)}m {callDetails.conversationDuration % 60}s)
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <Phone className="h-5 w-5 text-cyan-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-400">Caller Number</p>
                  <p className="text-lg font-semibold text-white">
                    {callDetails.callerNumber || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Callee and Direction Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <Phone className="h-5 w-5 text-purple-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-400">Callee Number</p>
                  <p className="text-lg font-semibold text-white">
                    {callDetails.calleeNumber || "N/A"}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <p className="text-sm text-slate-400 mb-1">Call Direction</p>
                <p className="text-lg font-semibold text-white capitalize">
                  {callDetails.callDirection}
                </p>
              </div>
            </div>

            {/* Voicemail Row - Full Width */}
            {/* <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-sm text-slate-400 mb-1">Voicemail</p>
              <p className="text-lg font-semibold text-white">
                {callDetails.voicemail ? "Yes" : "No"}
              </p>
            </div> */}
            {callDetails.recordingUrl && (
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <p className="text-sm text-slate-400 mb-2">Recording URL</p>
                <div className="flex items-center gap-2">
                  <p className="text-blue-400 break-all flex-1 font-mono text-sm">
                    {callDetails.recordingUrl}
                  </p>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyRecordingUrl}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800 flex-shrink-0"
                  >
                    {recordingUrlCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {callDetails?.callFlow && callDetails.callFlow.events && callDetails.callFlow.events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Call Flow Timeline</CardTitle>
            <CardDescription>
              Visual timeline of call events and interactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CallFlowTimeline 
              events={callDetails.callFlow.events} 
              callStartTime={callDetails.callTime}
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Search</DialogTitle>
            <DialogDescription>
              You are about to search for call details in the{" "}
              <strong>{region}</strong> region.
              {selectedPractice && (
                <>
                  <br />
                  <br />
                  Practice: <strong>{selectedPractice.practiceName}</strong>
                  <br />
                  Call ID: <strong>{watch("callId")}</strong>
                </>
              )}
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

