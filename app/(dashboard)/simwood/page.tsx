"use client";

import { useState, useEffect } from "react";
import { RouteProtection } from "@/components/route-protection";
import { ChannelUtilisationCard } from "@/components/simwood/channel-utilisation-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Settings, Link2, Phone, MessageSquare, FileText, Trash2, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  normalizePortingDashboardRow,
  type PortingDashboardRowShape,
  flattenPortingApiRow,
  resolvePortingMbn,
  extractPortingAssociatedNumbers,
} from "@/lib/porting-row-normalize";
const VOICE_CDR_SIZES = [10, 100, 1000, 10000] as const;
const MAX_CDR_DATE_RANGE_DAYS = 30;
const EMERGENCY999_FIELDS = ["title", "forename", "name", "bussuffix", "premises", "thoroughfare", "locality", "postcode"] as const;
type Emergency999Field = (typeof EMERGENCY999_FIELDS)[number];

interface Balance {
  balance: string;
  currency: string;
}


interface MyNumber {
  country_code: string;
  number: string;
  gold_price: string;
  block: string;
  type: string;
  SMS: string;
  crd?: string;
  status?: string;
}

interface AvailableNumber {
  country_code: string;
  number: string;
  recommended_gold_premium?: number;
  wholesale_gold_premium?: number;
  block?: string;
  bill_class?: string;
  type?: string;
  SMS?: number;
}

interface Trunk {
  trunk: string;
  serviceLevel: number;
  type: string;
  enabled_webrtc: string | null;
}

type PortingDashboardItem = PortingDashboardRowShape;

const PORTING_DASHBOARD_ASSOC_SECTION = {
  acceptedToday: "porting-assoc-accepted-today",
  acceptedTomorrow: "porting-assoc-accepted-tomorrow",
  completedYesterday: "porting-assoc-completed-yesterday",
  completedToday: "porting-assoc-completed-today",
} as const;

function portingRowNeedsAssociatedFetch(row: PortingDashboardItem): boolean {
  if (row.ref === "—" || !String(row.ref).trim()) return false;
  if (row.associatedNumbers.trim()) return false;
  if (row.associatedDetailLoaded) return false;
  return true;
}

/** Comma-separated numbers for clipboard (MBN + associated), same rules as copy. */
function buildPortingSectionNumbersList(rows: PortingDashboardItem[]): string {
  return rows
    .flatMap((row) => {
      const parts = [row.mbn.trim()];
      if (row.associatedNumbers.trim()) {
        parts.push(...row.associatedNumbers.split(",").map((s) => s.trim()));
      }
      return [...new Set(parts.filter((value) => value && value !== "—"))];
    })
    .join(",");
}

function portingSectionHasNumbersToCopy(rows: PortingDashboardItem[]): boolean {
  return buildPortingSectionNumbersList(rows).length > 0;
}

const PORTING_STATUS_LABELS: Record<string, string> = {
  rcvd: "Received",
  pending: "Pending",
  accepted: "Accepted",
  complete: "Complete",
  completed: "Complete",
  reject_lcp: "Rejected",
  rejected_lcp: "Rejected",
  submitted_lcp: "Submitted LCP",
  submitted_rh: "Submitted RH",
};

export default function SimwoodPage() {
  const [balance, setBalance] = useState<Balance[] | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("my-numbers");

  // My Numbers state
  const [myNumbersQuantity, setMyNumbersQuantity] = useState(10);
  const [myNumbersLoading, setMyNumbersLoading] = useState(false);
  const [myNumbers, setMyNumbers] = useState<MyNumber[]>([]);
  const [myNumbersSearch, setMyNumbersSearch] = useState("");
  const [myNumbersPage, setMyNumbersPage] = useState(1);
  const MY_NUMBERS_PAGE_SIZE = 10;
  const [myNumbersPortedTodayOnly, setMyNumbersPortedTodayOnly] = useState(false);
  const [trunks, setTrunks] = useState<Trunk[]>([]);
  const [trunksLoading, setTrunksLoading] = useState(false);
  const [showTrunkDialog, setShowTrunkDialog] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [selectedTrunk, setSelectedTrunk] = useState<string>("");
  const [attachingTrunk, setAttachingTrunk] = useState(false);

  // Standard/Gold Numbers state
  const [searchPattern, setSearchPattern] = useState("");
  const [numbersQuantity, setNumbersQuantity] = useState(10);
  const [standardNumbers, setStandardNumbers] = useState<AvailableNumber[]>([]);
  const [goldNumbers, setGoldNumbers] = useState<AvailableNumber[]>([]);
  const [standardLoading, setStandardLoading] = useState(false);
  const [goldLoading, setGoldLoading] = useState(false);
  const [allocatingNumber, setAllocatingNumber] = useState<string | null>(null);

  // Configure dialog (trunk, 999, SMS, reset, delete)
  const [showConfigureDialog, setShowConfigureDialog] = useState(false);
  const [configureNumber, setConfigureNumber] = useState<string | null>(null);
  const [configureCountryCode, setConfigureCountryCode] = useState<string | null>(null);
  const [configureTrunk, setConfigureTrunk] = useState("");
  const [currentTrunk, setCurrentTrunk] = useState<string | null>(null);
  const [currentTrunkLoading, setCurrentTrunkLoading] = useState(false);
  const [configureNumberType, setConfigureNumberType] = useState<string | null>(null);
  const [configureNumberTypeLoading, setConfigureNumberTypeLoading] = useState(false);
  const [emergency999Form, setEmergency999Form] = useState<Record<Emergency999Field, string>>({
    title: "", forename: "", name: "", bussuffix: "", premises: "", thoroughfare: "", locality: "", postcode: "",
  });
  const [emergency999Loading, setEmergency999Loading] = useState(false);
  const [smsEndpoint, setSmsEndpoint] = useState("");
  const [smsConfigLoading, setSmsConfigLoading] = useState(false);
  const [resetConfigLoading, setResetConfigLoading] = useState(false);
  const [resetConfigConfirmOpen, setResetConfigConfirmOpen] = useState(false);
  const [deleteNumberLoading, setDeleteNumberLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Voice CDR
  const [voiceCdrDateStart, setVoiceCdrDateStart] = useState("");
  const [voiceCdrDateEnd, setVoiceCdrDateEnd] = useState("");
  const [voiceCdrSize, setVoiceCdrSize] = useState<number>(100);
  const [voiceCdrPage, setVoiceCdrPage] = useState(1);
  const [voiceCdrDirection, setVoiceCdrDirection] = useState<"inbound" | "outbound" | "both">("both");
  const [voiceCdrLoading, setVoiceCdrLoading] = useState(false);
  const [voiceCdrData, setVoiceCdrData] = useState<{ count: number; data: Array<Record<string, unknown>> } | null>(null);

  // SMS CDR
  const [smsCdrQuantity, setSmsCdrQuantity] = useState(10);
  const [smsCdrLoading, setSmsCdrLoading] = useState(false);
  const [smsCdrData, setSmsCdrData] = useState<Array<Record<string, unknown>>>([]);
  const [smsCdrPage, setSmsCdrPage] = useState(1);
  const SMS_CDR_PAGE_SIZE = 10;

  // Porting Dashboard
  const [portingDashboardRows, setPortingDashboardRows] = useState<PortingDashboardItem[]>([]);
  const [portingDashboardLoading, setPortingDashboardLoading] = useState(false);
  const [portingSearch, setPortingSearch] = useState("");
  const [portingStatusFilter, setPortingStatusFilter] = useState("all");
  const [portingUpcomingAcceptedOnly, setPortingUpcomingAcceptedOnly] = useState(false);
  const [portingPage, setPortingPage] = useState(1);
  const PORTING_PAGE_SIZE = 10;
  const [portingAssocLoadingByKey, setPortingAssocLoadingByKey] = useState<Record<string, boolean>>({});
  const [portingAssocSectionLoading, setPortingAssocSectionLoading] = useState<Record<string, boolean>>({});

  // Load balance on mount
  useEffect(() => {
    loadBalance();
  }, []);

  // Load trunks when My Numbers tab is active
  useEffect(() => {
    if (activeTab === "my-numbers" && trunks.length === 0) {
      loadTrunks();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "porting-dashboard" && portingDashboardRows.length === 0) {
      loadPortingDashboard();
    }
  }, [activeTab, portingDashboardRows.length]);

  useEffect(() => {
    setPortingPage(1);
  }, [portingSearch, portingStatusFilter, portingUpcomingAcceptedOnly, portingDashboardRows.length]);

  // When Configure dialog opens, fetch current trunk, number type, and emergency 999 details
  useEffect(() => {
    if (!showConfigureDialog || !configureNumber) return;
    setCurrentTrunk(null);
    setConfigureNumberType(null);

    const fetchTrunk = async () => {
      setCurrentTrunkLoading(true);
      try {
        const url = configureCountryCode
          ? `/api/simwood/allocated/${encodeURIComponent(configureNumber)}/trunk?countryCode=${encodeURIComponent(configureCountryCode)}`
          : `/api/simwood/allocated/${encodeURIComponent(configureNumber)}/trunk`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setCurrentTrunk(data?.data?.trunk ?? null);
        } else {
          setCurrentTrunk(null);
        }
      } catch {
        setCurrentTrunk(null);
      } finally {
        setCurrentTrunkLoading(false);
      }
    };

    const fetchNumberType = async () => {
      setConfigureNumberTypeLoading(true);
      try {
        const params = new URLSearchParams({ number: configureNumber });
        if (configureCountryCode) params.set("countryCode", configureCountryCode);
        const res = await fetch(`/api/simwood/validate?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setConfigureNumberType(data?.data?.type ?? null);
        } else {
          setConfigureNumberType(null);
        }
      } catch {
        setConfigureNumberType(null);
      } finally {
        setConfigureNumberTypeLoading(false);
      }
    };

    const fetchEmergency999 = async () => {
      try {
        const url = configureCountryCode
          ? `/api/simwood/allocated/${encodeURIComponent(configureNumber)}/999?countryCode=${encodeURIComponent(configureCountryCode)}`
          : `/api/simwood/allocated/${encodeURIComponent(configureNumber)}/999`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const record = Array.isArray(data) && data.length > 0 ? data[0] : null;
          if (record && typeof record === "object") {
            setEmergency999Form({
              title: record.title ?? "",
              forename: record.forename ?? "",
              name: record.name ?? "",
              bussuffix: record.bussuffix ?? "",
              premises: record.premises ?? "",
              thoroughfare: record.thoroughfare ?? "",
              locality: record.locality ?? "",
              postcode: record.postcode ?? "",
            });
          }
        }
      } catch {
        // keep existing form state on error
      }
    };

    fetchTrunk();
    fetchNumberType();
    fetchEmergency999();
  }, [showConfigureDialog, configureNumber, configureCountryCode]);

  const loadBalance = async () => {
    try {
      setBalanceLoading(true);
      const response = await fetch("/api/simwood/balance");
      if (!response.ok) {
        throw new Error("Failed to fetch balance");
      }
      const data = await response.json();
      setBalance(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load balance");
    } finally {
      setBalanceLoading(false);
    }
  };

  const loadTrunks = async () => {
    try {
      setTrunksLoading(true);
      const response = await fetch("/api/simwood/trunks");
      if (!response.ok) throw new Error("Failed to fetch trunks");
      const data = await response.json();
      setTrunks(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load trunks");
    } finally {
      setTrunksLoading(false);
    }
  };

  const loadMyNumbers = async (portedTomorrowOnly = myNumbersPortedTodayOnly) => {
    try {
      setMyNumbersLoading(true);
      if (portedTomorrowOnly) {
        const response = await fetch("/api/simwood/porting-dashboard");
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch ported numbers");
        }
        const result = (await response.json()) as {
          data?: Array<Record<string, unknown>>;
        };
        const rows = Array.isArray(result.data) ? result.data : [];
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const toDateOnly = (value: unknown): Date | null => {
          if (typeof value !== "string" || !value.trim()) return null;
          const d = new Date(value);
          if (Number.isNaN(d.getTime())) return null;
          d.setHours(0, 0, 0, 0);
          return d;
        };

        const isAccepted = (row: Record<string, unknown>): boolean => {
          const status = String(row.status ?? "").toLowerCase();
          const statusCode = String(row.status_code ?? "").toLowerCase();
          return status.includes("accepted") || statusCode.includes("accepted");
        };

        const list: MyNumber[] = rows
          .filter((row) => {
            if (!isAccepted(row)) return false;
            const crdRaw = String(row.crd ?? row.date_port ?? "");
            const crdDate = toDateOnly(crdRaw);
            return !!crdDate && crdDate.getTime() === tomorrow.getTime();
          })
          .flatMap((row) => {
            const rec = row as Record<string, unknown>;
            const flat = flattenPortingApiRow(rec);
            const primaryRaw =
              resolvePortingMbn(flat) ||
              String(flat.mbn ?? flat.msisdn ?? flat.number ?? rec.mbn ?? rec.msisdn ?? rec.number ?? "").trim();
            if (!primaryRaw) return [];

            const assocStr = extractPortingAssociatedNumbers(flat, primaryRaw);
            const assocParts = assocStr
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const uniqueNumbers = [...new Set([primaryRaw, ...assocParts])];

            const portType = String(
              flat.port_type ?? rec.port_type ?? (flat.msisdn || rec.msisdn ? "mobile" : "local")
            );
            const crdVal = String(flat.crd ?? flat.date_port ?? rec.crd ?? rec.date_port ?? "—");
            const statusVal = String(flat.status ?? flat.status_code ?? rec.status ?? rec.status_code ?? "—");

            return uniqueNumbers.map((numStr) => ({
              country_code: "",
              number: numStr,
              gold_price: "",
              block: "",
              type: portType,
              SMS: "",
              crd: crdVal,
              status: statusVal,
            }));
          })
          .filter((item) => item.number.trim().length > 0);

        const enrichedList = await Promise.all(
          list.map(async (item) => {
            try {
              const params = new URLSearchParams({ number: item.number });
              const validateRes = await fetch(`/api/simwood/validate?${params.toString()}`);
              if (!validateRes.ok) return item;
              const validateData = (await validateRes.json()) as {
                data?: { country_code?: string; type?: string };
              };
              return {
                ...item,
                country_code: validateData?.data?.country_code ?? item.country_code,
                type: validateData?.data?.type ?? item.type,
              };
            } catch {
              return item;
            }
          })
        );

        const normalizePortedDisplayNumber = (rawNumber: string, countryCode?: string): string => {
          const digits = String(rawNumber ?? "").replace(/\D+/g, "");
          if (!digits) return "";

          const ccDigits = String(countryCode ?? "").replace(/\D+/g, "");
          let local = digits;

          if (ccDigits && local.startsWith(ccDigits) && local.length > ccDigits.length) {
            local = local.slice(ccDigits.length);
          } else if (local.startsWith("44") && local.length > 2) {
            // Fallback for UK numbers when validate API does not return country_code.
            local = local.slice(2);
          }

          return local.replace(/^0+/, "");
        };

        const displayList = enrichedList.map((item) => ({
          ...item,
          number: normalizePortedDisplayNumber(item.number, item.country_code),
        }));

        setMyNumbers(displayList);
        setMyNumbersPage(1);
        setMyNumbersSearch("");
        toast.success(`Loaded ${displayList.length} ported numbers (CRD tomorrow + Accepted)`);
        return;
      }

      const response = await fetch("/api/simwood/allocated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: myNumbersQuantity }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch allocated numbers");
      }

      const result = await response.json();
      const hash = result.hash;

      // Fetch numbers from file using hash
      const numbersResponse = await fetch(`/api/simwood/files/${hash}`);
      if (!numbersResponse.ok) {
        throw new Error("Failed to fetch numbers from file");
      }

      const numbers = await numbersResponse.json();
      setMyNumbers(numbers);
      setMyNumbersPage(1);
      setMyNumbersSearch("");
      toast.success(`Loaded ${numbers.length} numbers`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load numbers");
      setMyNumbers([]);
    } finally {
      setMyNumbersLoading(false);
    }
  };

  const loadStandardNumbers = async () => {
    try {
      setStandardLoading(true);
      const params = new URLSearchParams();
      params.append("quantity", numbersQuantity.toString());
      if (searchPattern) {
        params.append("pattern", searchPattern);
      }

      const response = await fetch(`/api/simwood/available/standard?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch standard numbers");
      }

      const data = await response.json();
      setStandardNumbers(data);
      toast.success(`Found ${data.length} standard numbers`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load standard numbers");
      setStandardNumbers([]);
    } finally {
      setStandardLoading(false);
    }
  };

  const loadGoldNumbers = async () => {
    try {
      setGoldLoading(true);
      const params = new URLSearchParams();
      params.append("quantity", numbersQuantity.toString());
      if (searchPattern) {
        params.append("pattern", searchPattern);
      }

      const response = await fetch(`/api/simwood/available/gold?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch gold numbers");
      }

      const data = await response.json();
      setGoldNumbers(data);
      toast.success(`Found ${data.length} gold numbers`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load gold numbers");
      setGoldNumbers([]);
    } finally {
      setGoldLoading(false);
    }
  };

  const handleAttachTrunk = (number: string, countryCode?: string) => {
    setSelectedNumber(number);
    setSelectedCountryCode(countryCode ?? null);
    setSelectedTrunk("");
    setShowTrunkDialog(true);
  };

  const openConfigure = (number: string, countryCode?: string) => {
    setConfigureNumber(number);
    setConfigureCountryCode(countryCode ?? null);
    setConfigureTrunk("");
    setShowConfigureDialog(true);
    setEmergency999Form({ title: "", forename: "", name: "", bussuffix: "", premises: "", thoroughfare: "", locality: "", postcode: "" });
    setSmsEndpoint("");
    setResetConfigConfirmOpen(false);
    setDeleteConfirmOpen(false);
  };

  /** Single attach-trunk action: used by both standalone dialog and Configure modal */
  const doAttachTrunk = async (
    number: string,
    countryCode: string | null,
    trunk: string
  ): Promise<boolean> => {
    if (!number || !trunk) {
      toast.error("Please select a trunk");
      return false;
    }
    try {
      setAttachingTrunk(true);
      const trunkUrl = countryCode
        ? `/api/simwood/allocated/${encodeURIComponent(number)}/trunk?countryCode=${encodeURIComponent(countryCode)}`
        : `/api/simwood/allocated/${encodeURIComponent(number)}/trunk`;
      const response = await fetch(trunkUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trunk }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? "Failed to attach trunk");
      }
      const data = await response.json();
      toast.success("Trunk attached");
      if (number === configureNumber) setCurrentTrunk(data?.data?.trunk ?? null);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to attach trunk");
      return false;
    } finally {
      setAttachingTrunk(false);
    }
  };

  const confirmAttachTrunk = async () => {
    if (!selectedNumber || !selectedTrunk) return;
    const ok = await doAttachTrunk(selectedNumber, selectedCountryCode, selectedTrunk);
    if (ok) {
      setShowTrunkDialog(false);
      setSelectedNumber(null);
      setSelectedCountryCode(null);
      setSelectedTrunk("");
    }
  };

  const submitEmergency999 = async () => {
    if (!configureNumber) return;
    const numberForApi = configureCountryCode ? `${configureCountryCode}${configureNumber}` : configureNumber;
    try {
      setEmergency999Loading(true);
      const response = await fetch(`/api/simwood/allocated/${encodeURIComponent(numberForApi)}/999`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emergency999Form),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update emergency details");
      }
      toast.success("Emergency 999 details updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setEmergency999Loading(false);
    }
  };

  const submitSmsConfig = async () => {
    if (!configureNumber) return;
    if (!smsEndpoint.trim()) {
      toast.error("Endpoint is required");
      return;
    }
    const numberForApi = configureCountryCode ? `${configureCountryCode}${configureNumber}` : configureNumber;
    try {
      setSmsConfigLoading(true);
      const response = await fetch(`/api/simwood/allocated/${encodeURIComponent(numberForApi)}/sms`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: smsEndpoint.trim() }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update SMS config");
      }
      toast.success("SMS configuration updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setSmsConfigLoading(false);
    }
  };

  const confirmResetConfig = async () => {
    if (!configureNumber) return;
    const numberForApi = configureCountryCode ? `${configureCountryCode}${configureNumber}` : configureNumber;
    try {
      setResetConfigLoading(true);
      const response = await fetch(`/api/simwood/allocated/${encodeURIComponent(numberForApi)}/config`, { method: "DELETE" });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to reset config");
      }
      toast.success("Number configuration reset");
      setResetConfigConfirmOpen(false);
      setCurrentTrunk(null);
      const trunkUrl = configureCountryCode
        ? `/api/simwood/allocated/${encodeURIComponent(configureNumber)}/trunk?countryCode=${encodeURIComponent(configureCountryCode)}`
        : `/api/simwood/allocated/${encodeURIComponent(configureNumber)}/trunk`;
      const res = await fetch(trunkUrl);
      if (res.ok) {
        const data = await res.json();
        setCurrentTrunk(data?.data?.trunk ?? null);
      }
      // Reset emergency 999 details
      setEmergency999Form({ title: "", forename: "", name: "", bussuffix: "", premises: "", thoroughfare: "", locality: "", postcode: "" });
      const emergency999Url = configureCountryCode
        ? `/api/simwood/allocated/${encodeURIComponent(configureNumber)}/999?countryCode=${encodeURIComponent(configureCountryCode)}`
        : `/api/simwood/allocated/${encodeURIComponent(configureNumber)}/999`;
      const emergency999Res = await fetch(emergency999Url);
      if (emergency999Res.ok) {
        const emergency999Data = await emergency999Res.json();
        const record = Array.isArray(emergency999Data) && emergency999Data.length > 0 ? emergency999Data[0] : null;
        if (record && typeof record === "object") {
          setEmergency999Form(record);
        }
      } else {
        setEmergency999Form({ title: "", forename: "", name: "", bussuffix: "", premises: "", thoroughfare: "", locality: "", postcode: "" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset");
    } finally {
      setResetConfigLoading(false);
    }
  };

  const confirmDeleteNumber = async () => {
    if (!configureNumber) return;
    const numberForApi = configureCountryCode ? `${configureCountryCode}${configureNumber}` : configureNumber;
    try {
      setDeleteNumberLoading(true);
      const response = await fetch(`/api/simwood/allocated/${encodeURIComponent(numberForApi)}`, { method: "DELETE" });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete number");
      }
      toast.success("Number deleted");
      setShowConfigureDialog(false);
      setConfigureNumber(null);
      setDeleteConfirmOpen(false);
      setMyNumbers((prev) => prev.filter((n) => n.number !== configureNumber));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeleteNumberLoading(false);
    }
  };

  const loadVoiceCdr = async (pageOverride?: number) => {
    if (!voiceCdrDateStart || !voiceCdrDateEnd) {
      toast.error("Select date range");
      return;
    }
    const start = new Date(voiceCdrDateStart);
    const end = new Date(voiceCdrDateEnd);
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (days > MAX_CDR_DATE_RANGE_DAYS) {
      toast.error(`Date range must not exceed ${MAX_CDR_DATE_RANGE_DAYS} days`);
      return;
    }
    const page = pageOverride ?? voiceCdrPage;
    try {
      setVoiceCdrLoading(true);
      const response = await fetch("/api/simwood/voice-cdr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date_start: voiceCdrDateStart,
          date_end: voiceCdrDateEnd,
          size: voiceCdrSize,
          page,
          direction: voiceCdrDirection,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch voice CDR");
      }
      const data = await response.json();
      setVoiceCdrData({ count: data.count, data: data.data || [] });
      if (pageOverride !== undefined) setVoiceCdrPage(pageOverride);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch voice CDR");
      setVoiceCdrData(null);
    } finally {
      setVoiceCdrLoading(false);
    }
  };

  const loadSmsCdr = async () => {
    try {
      setSmsCdrLoading(true);
      const reportRes = await fetch(`/api/simwood/sms-cdr/report?quantity=${smsCdrQuantity}`);
      if (!reportRes.ok) {
        const err = await reportRes.json();
        throw new Error(err.error || "Failed to fetch SMS CDR report");
      }
      const report = await reportRes.json();
      const hash = report.hash;
      if (!hash) throw new Error("No hash in report");
      const fileRes = await fetch(`/api/simwood/files/${hash}`);
      if (!fileRes.ok) throw new Error("Failed to fetch SMS CDR file");
      const list = await fileRes.json();
      setSmsCdrData(Array.isArray(list) ? list : []);
      setSmsCdrPage(1);
      toast.success(`Loaded ${Array.isArray(list) ? list.length : 0} SMS CDR records`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch SMS CDR");
      setSmsCdrData([]);
    } finally {
      setSmsCdrLoading(false);
    }
  };

  const loadPortingDashboard = async () => {
    try {
      setPortingDashboardLoading(true);
      const response = await fetch("/api/simwood/porting-dashboard");
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch porting dashboard");
      }

      const result = (await response.json()) as {
        data?: Array<Record<string, unknown>>;
      };
      const rows = Array.isArray(result.data) ? result.data : [];
      const normalized: PortingDashboardItem[] = rows.map((row) =>
        normalizePortingDashboardRow(row as Record<string, unknown>)
      );
      setPortingDashboardRows(normalized);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load porting dashboard");
      setPortingDashboardRows([]);
    } finally {
      setPortingDashboardLoading(false);
    }
  };

  const portingRowDetailKey = (row: PortingDashboardItem) => `${row.portKind}:${row.ref}`;

  const fetchPortingAssocFromApi = async (row: PortingDashboardItem): Promise<string> => {
    const qs = new URLSearchParams({ ref: row.ref, kind: row.portKind });
    const res = await fetch(`/api/simwood/porting-detail?${qs}`);
    const body = (await res.json()) as { error?: string; associatedNumbers?: string };
    if (!res.ok) {
      throw new Error(body.error || "Failed to load associated numbers");
    }
    return typeof body.associatedNumbers === "string" ? body.associatedNumbers : "";
  };

  const loadPortingAssociatedNumbers = async (row: PortingDashboardItem) => {
    const key = portingRowDetailKey(row);
    if (row.ref === "—" || !String(row.ref).trim()) return;
    if (row.associatedNumbers.trim()) return;
    if (row.associatedDetailLoaded) return;

    setPortingAssocLoadingByKey((prev) => ({ ...prev, [key]: true }));
    try {
      const assoc = await fetchPortingAssocFromApi(row);
      setPortingDashboardRows((prev) =>
        prev.map((r) =>
          portingRowDetailKey(r) === key
            ? { ...r, associatedNumbers: assoc.trim(), associatedDetailLoaded: true }
            : r
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load associated numbers");
    } finally {
      setPortingAssocLoadingByKey((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const loadPortingAssociatedForSection = async (
    rows: PortingDashboardItem[],
    sectionId: (typeof PORTING_DASHBOARD_ASSOC_SECTION)[keyof typeof PORTING_DASHBOARD_ASSOC_SECTION]
  ) => {
    const pending = rows.filter(portingRowNeedsAssociatedFetch);
    if (pending.length === 0) {
      toast.info("Associated numbers are already loaded for every row in this section.");
      return;
    }

    const keys = pending.map(portingRowDetailKey);
    setPortingAssocSectionLoading((s) => ({ ...s, [sectionId]: true }));
    setPortingAssocLoadingByKey((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = true;
      return next;
    });

    try {
      const outcomes = await Promise.all(
        pending.map(async (row) => {
          const key = portingRowDetailKey(row);
          try {
            const assoc = await fetchPortingAssocFromApi(row);
            return { key, ok: true as const, assoc };
          } catch (e) {
            return {
              key,
              ok: false as const,
              error: e instanceof Error ? e.message : "Failed to load",
            };
          }
        })
      );

      const okMap = new Map<string, string>();
      for (const o of outcomes) {
        if (o.ok) okMap.set(o.key, o.assoc.trim());
      }
      if (okMap.size > 0) {
        setPortingDashboardRows((prev) =>
          prev.map((r) => {
            const k = portingRowDetailKey(r);
            if (!okMap.has(k)) return r;
            return {
              ...r,
              associatedNumbers: okMap.get(k)!,
              associatedDetailLoaded: true,
            };
          })
        );
      }

      const failed = outcomes.filter((o) => !o.ok);
      if (failed.length > 0) {
        toast.error(
          failed.length === outcomes.length
            ? "Failed to load associated numbers for this section."
            : `${failed.length} of ${outcomes.length} rows failed to load associated numbers.`
        );
      }
    } finally {
      setPortingAssocSectionLoading((s) => {
        const next = { ...s };
        delete next[sectionId];
        return next;
      });
      setPortingAssocLoadingByKey((prev) => {
        const next = { ...prev };
        for (const k of keys) delete next[k];
        return next;
      });
    }
  };

  const renderPortingAssociatedCell = (row: PortingDashboardItem) => {
    const key = portingRowDetailKey(row);
    const loading = Boolean(portingAssocLoadingByKey[key]);
    const assocTextClass = "text-sm text-slate-400 break-all font-normal";

    if (row.associatedNumbers.trim()) {
      return <span className={assocTextClass}>{row.associatedNumbers}</span>;
    }
    if (row.associatedDetailLoaded) {
      return <span className={assocTextClass}>—</span>;
    }
    if (row.ref === "—" || !String(row.ref).trim()) {
      return <span className={assocTextClass}>—</span>;
    }
    if (loading) {
      return (
        <span
          className="inline-flex h-7 items-center justify-start"
          aria-busy="true"
          aria-label="Loading associated numbers"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />
        </span>
      );
    }
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => void loadPortingAssociatedNumbers(row)}
      >
        Show
      </Button>
    );
  };

  const toLocalDateOnly = (value: string): Date | null => {
    if (!value || value === "—") return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  };

  const formatDateOnly = (value: string): string => {
    const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!value || value === "—") return "—";
    if (dateOnlyPattern.test(value.trim())) return value.trim();

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getPortingStatusKey = (row: PortingDashboardItem): string =>
    (row.statusCode || row.status || "unknown")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");

  const getPortingStatusLabel = (statusKey: string): string => {
    if (PORTING_STATUS_LABELS[statusKey]) return PORTING_STATUS_LABELS[statusKey];
    return statusKey
      .split("_")
      .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
      .join(" ");
  };

  const getPortingStatusClass = (statusKey: string): string => {
    if (statusKey.includes("accept")) return "bg-blue-500/20 text-blue-300 border border-blue-500/30";
    if (statusKey.includes("complete")) return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
    if (statusKey.includes("reject")) return "bg-red-500/20 text-red-300 border border-red-500/30";
    if (statusKey.includes("submit")) return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
    if (statusKey.includes("pending") || statusKey.includes("rcvd")) return "bg-slate-500/20 text-slate-300 border border-slate-500/30";
    return "bg-slate-500/20 text-slate-300 border border-slate-500/30";
  };

  const isAcceptedStatus = (row: PortingDashboardItem): boolean =>
    getPortingStatusKey(row).includes("accepted");
  const isCompletedStatus = (row: PortingDashboardItem): boolean =>
    getPortingStatusKey(row).includes("complete");

  const handleAllocateNumber = async (number: string, countryCode?: string) => {
    try {
      setAllocatingNumber(number);
      const response = await fetch("/api/simwood/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, countryCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to allocate number");
      }

      toast.success(`Number ${number} allocated successfully`);
      // Reload balance after allocation
      loadBalance();
      // Reload numbers list
      if (activeTab === "standard-numbers") {
        loadStandardNumbers();
      } else if (activeTab === "gold-numbers") {
        loadGoldNumbers();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to allocate number");
    } finally {
      setAllocatingNumber(null);
    }
  };

  const currentBalance = balance?.[0];

  // My Numbers: client-side search by number and pagination
  const myNumbersFiltered = myNumbers.filter((n) =>
    !myNumbersSearch.trim() ? true : n.number.includes(myNumbersSearch.trim())
  );
  const myNumbersTotalPages = Math.ceil(myNumbersFiltered.length / MY_NUMBERS_PAGE_SIZE) || 1;
  const myNumbersPaginated = myNumbersFiltered.slice(
    (myNumbersPage - 1) * MY_NUMBERS_PAGE_SIZE,
    myNumbersPage * MY_NUMBERS_PAGE_SIZE
  );

  const portingStatuses = Array.from(
    new Set(
      portingDashboardRows
        .map((row) => getPortingStatusKey(row))
        .filter((value) => value && value !== "unknown")
    )
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const portingFilteredRows = portingDashboardRows
    .filter((row) => {
      const search = portingSearch.trim().toLowerCase();
      if (search) {
        const matched =
          row.mbn.toLowerCase().includes(search) ||
          row.ref.toLowerCase().includes(search) ||
          row.associatedNumbers.toLowerCase().includes(search);
        if (!matched) return false;
      }

      if (portingStatusFilter !== "all") {
        const rowStatus = getPortingStatusKey(row);
        if (rowStatus !== portingStatusFilter) return false;
      }

      if (portingUpcomingAcceptedOnly) {
        if (!isAcceptedStatus(row)) return false;
        const crdDate = toLocalDateOnly(row.crd);
        if (!crdDate || crdDate < today) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (!portingUpcomingAcceptedOnly) return 0;
      const aDate = toLocalDateOnly(a.crd);
      const bDate = toLocalDateOnly(b.crd);
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return aDate.getTime() - bDate.getTime();
    });

  const acceptedTodayRows = portingDashboardRows.filter((row) => {
    if (!isAcceptedStatus(row)) return false;
    const crdDate = toLocalDateOnly(row.crd);
    return !!crdDate && crdDate.getTime() === today.getTime();
  });

  const acceptedTomorrowRows = portingDashboardRows.filter((row) => {
    if (!isAcceptedStatus(row)) return false;
    const crdDate = toLocalDateOnly(row.crd);
    return !!crdDate && crdDate.getTime() === tomorrow.getTime();
  });

  const completedYesterdayRows = portingDashboardRows.filter((row) => {
    if (!isCompletedStatus(row)) return false;
    const crdDate = toLocalDateOnly(row.crd);
    return !!crdDate && crdDate.getTime() === yesterday.getTime();
  });

  const completedTodayRows = portingDashboardRows.filter((row) => {
    if (!isCompletedStatus(row)) return false;
    const crdDate = toLocalDateOnly(row.crd);
    return !!crdDate && crdDate.getTime() === today.getTime();
  });
  const portingSubmittedCount = portingDashboardRows.filter((row) =>
    getPortingStatusKey(row).includes("submit")
  ).length;
  const portingRejectedCount = portingDashboardRows.filter((row) =>
    getPortingStatusKey(row).includes("reject")
  ).length;
  const portingPendingCount = portingDashboardRows.filter((row) => {
    const key = getPortingStatusKey(row);
    return key.includes("pending") || key.includes("rcvd");
  }).length;
  const portingAcceptedCount = portingDashboardRows.filter((row) => isAcceptedStatus(row)).length;
  const portingCompletedCount = portingDashboardRows.filter((row) => isCompletedStatus(row)).length;
  const portingShowingStart = portingFilteredRows.length === 0 ? 0 : (portingPage - 1) * PORTING_PAGE_SIZE + 1;
  const portingShowingEnd = Math.min(portingPage * PORTING_PAGE_SIZE, portingFilteredRows.length);

  const copySectionNumbers = async (
    rows: PortingDashboardItem[],
    sectionLabel: string
  ) => {
    const list = buildPortingSectionNumbersList(rows);
    if (!list) {
      toast.error(`No numbers available in ${sectionLabel}`);
      return;
    }
    try {
      await navigator.clipboard.writeText(list);
      toast.success(`Copied ${rows.length} numbers from ${sectionLabel}`);
    } catch {
      toast.error("Failed to copy numbers");
    }
  };
  const portingTotalPages = Math.ceil(portingFilteredRows.length / PORTING_PAGE_SIZE) || 1;
  const portingPaginatedRows = portingFilteredRows.slice(
    (portingPage - 1) * PORTING_PAGE_SIZE,
    portingPage * PORTING_PAGE_SIZE
  );

  return (
    <RouteProtection>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Simwood Dashboard</h1>
          <p className="text-slate-400 mt-2">Manage your SIMWOOD numbers and account</p>
        </div>

        {/* Balance Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Balance</CardTitle>
            <CardDescription>Current prepay balance</CardDescription>
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : currentBalance ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-white">
                  {currentBalance.balance} {currentBalance.currency}
                </span>
              </div>
            ) : (
              <p className="text-slate-400">Unable to load balance</p>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="my-numbers">My Numbers</TabsTrigger>
            <TabsTrigger value="standard-numbers">Standard</TabsTrigger>
            <TabsTrigger value="gold-numbers">Gold</TabsTrigger>
            <TabsTrigger value="voice-cdr">Voice CDR</TabsTrigger>
            <TabsTrigger value="sms-cdr">SMS CDR</TabsTrigger>
            <TabsTrigger value="channel-utilisation">Channels</TabsTrigger>
            <TabsTrigger value="porting-dashboard">Port In</TabsTrigger>
          </TabsList>

          {/* My Numbers Tab */}
          <TabsContent value="my-numbers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>My Numbers</CardTitle>
                <CardDescription>View and manage your allocated numbers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Select
                      value={myNumbersQuantity.toString()}
                      onValueChange={(value) => setMyNumbersQuantity(parseInt(value, 10))}
                      disabled={myNumbersPortedTodayOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="1000">1000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="ml-auto flex items-center gap-4 rounded-md border border-slate-800 px-3 py-2">
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="radio"
                        name="my-number-source"
                        checked={!myNumbersPortedTodayOnly}
                        onChange={() => setMyNumbersPortedTodayOnly(false)}
                        className="h-4 w-4 accent-blue-500"
                      />
                      All numbers
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="radio"
                        name="my-number-source"
                        checked={myNumbersPortedTodayOnly}
                        onChange={() => setMyNumbersPortedTodayOnly(true)}
                        className="h-4 w-4 accent-blue-500"
                      />
                      CRD tomorrow numbers
                    </label>
                  </div>
                  <Button onClick={() => loadMyNumbers(myNumbersPortedTodayOnly)} disabled={myNumbersLoading}>
                    {myNumbersLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load Numbers"
                    )}
                  </Button>
                </div>

                {myNumbers.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <Label htmlFor="my-numbers-search">Search by number</Label>
                        <Input
                          id="my-numbers-search"
                          placeholder="e.g. 447700 or 113"
                          value={myNumbersSearch}
                          onChange={(e) => {
                            setMyNumbersSearch(e.target.value);
                            setMyNumbersPage(1);
                          }}
                        />
                      </div>
                      <p className="text-sm text-slate-400 self-end">
                        {myNumbersFiltered.length} of {myNumbers.length} numbers
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-800">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Country</TableHead>
                            <TableHead>Number</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {myNumbersPaginated.map((num, index) => (
                            <TableRow key={`${num.number}-${index}`}>
                              <TableCell>{num.type}</TableCell>
                              <TableCell>{num.country_code || "—"}</TableCell>
                              <TableCell className="font-medium">{num.number}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleAttachTrunk(
                                        num.number,
                                        num.country_code && !String(num.number).startsWith(String(num.country_code))
                                          ? num.country_code
                                          : undefined
                                      )
                                    }
                                  >
                                    <Link2 className="mr-2 h-4 w-4" />
                                    Attach Trunk
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      openConfigure(
                                        num.number,
                                        num.country_code && !String(num.number).startsWith(String(num.country_code))
                                          ? num.country_code
                                          : undefined
                                      )
                                    }
                                  >
                                    <Settings className="mr-2 h-4 w-4" />
                                    Configure
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {myNumbersTotalPages > 1 && (
                        <div className="flex justify-between items-center p-2 border-t border-slate-800">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={myNumbersPage <= 1}
                            onClick={() => setMyNumbersPage((p) => Math.max(1, p - 1))}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-slate-400">
                            Page {myNumbersPage} of {myNumbersTotalPages} ({myNumbersFiltered.length} results)
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={myNumbersPage >= myNumbersTotalPages}
                            onClick={() => setMyNumbersPage((p) => p + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Standard Numbers Tab */}
          <TabsContent value="standard-numbers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Standard Numbers</CardTitle>
                <CardDescription>Search and allocate standard numbers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="pattern">Search Pattern</Label>
                    <Input
                      id="pattern"
                      placeholder="*113, 113*, *113*"
                      value={searchPattern}
                      onChange={(e) => setSearchPattern(e.target.value)}
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Use * for wildcard (e.g., *113, 113*, *113*)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Select
                      value={numbersQuantity.toString()}
                      onValueChange={(value) => setNumbersQuantity(parseInt(value, 10))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="1000">1000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={loadStandardNumbers} disabled={standardLoading} className="w-full">
                      {standardLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        "Search"
                      )}
                    </Button>
                  </div>
                </div>

                {standardNumbers.length > 0 && (
                  <div className="rounded-md border border-slate-800 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Country</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {standardNumbers.map((num, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-slate-300">{String((num as unknown as Record<string, unknown>).type ?? num.bill_class ?? "—")}</TableCell>
                            <TableCell>{num.country_code}</TableCell>
                            <TableCell className="font-medium">{num.number}</TableCell>
                            <TableCell>
                              {typeof num.recommended_gold_premium === "number"
                                ? `${num.recommended_gold_premium} ${currentBalance?.currency ?? "GBP"}`
                                : typeof num.wholesale_gold_premium === "number"
                                  ? `${num.wholesale_gold_premium} ${currentBalance?.currency ?? "GBP"}`
                                  : "0"}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAllocateNumber(num.number, num.country_code)}
                                disabled={allocatingNumber === num.number}
                              >
                                {allocatingNumber === num.number ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Allocating...
                                  </>
                                ) : (
                                  "Allocate"
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gold Numbers Tab */}
          <TabsContent value="gold-numbers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gold Numbers</CardTitle>
                <CardDescription>Search and allocate premium gold numbers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="pattern-gold">Search Pattern</Label>
                    <Input
                      id="pattern-gold"
                      placeholder="*113, 113*, *113*"
                      value={searchPattern}
                      onChange={(e) => setSearchPattern(e.target.value)}
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Use * for wildcard (e.g., *113, 113*, *113*)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="quantity-gold">Quantity</Label>
                    <Select
                      value={numbersQuantity.toString()}
                      onValueChange={(value) => setNumbersQuantity(parseInt(value, 10))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="1000">1000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={loadGoldNumbers} disabled={goldLoading} className="w-full">
                      {goldLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        "Search"
                      )}
                    </Button>
                  </div>
                </div>

                {goldNumbers.length > 0 && (
                  <div className="rounded-md border border-slate-800 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Country</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {goldNumbers.map((num, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-slate-300">{String((num as unknown as Record<string, unknown>).type ?? num.bill_class ?? "—")}</TableCell>
                            <TableCell>{num.country_code}</TableCell>
                            <TableCell className="font-medium">{num.number}</TableCell>
                            <TableCell>
                              {typeof num.recommended_gold_premium === "number"
                                ? `${num.recommended_gold_premium} ${currentBalance?.currency ?? "GBP"}`
                                : typeof num.wholesale_gold_premium === "number"
                                  ? `${num.wholesale_gold_premium} ${currentBalance?.currency ?? "GBP"}`
                                  : `0 ${currentBalance?.currency ?? "GBP"}`}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAllocateNumber(num.number, num.country_code)}
                                disabled={allocatingNumber === num.number}
                              >
                                {allocatingNumber === num.number ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Allocating...
                                  </>
                                ) : (
                                  "Allocate"
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Voice CDR Tab */}
          <TabsContent value="voice-cdr" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Voice CDR
              </CardTitle>
              <CardDescription>
                Fetch voice CDR (max date range {MAX_CDR_DATE_RANGE_DAYS} days). Size: 10, 100, 1000, 10000.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <Label>Date start</Label>
                  <Input
                    type="date"
                    value={voiceCdrDateStart}
                    onChange={(e) => setVoiceCdrDateStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Date end</Label>
                  <Input
                    type="date"
                    value={voiceCdrDateEnd}
                    onChange={(e) => setVoiceCdrDateEnd(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Size</Label>
                  <Select
                    value={voiceCdrSize.toString()}
                    onValueChange={(v) => setVoiceCdrSize(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_CDR_SIZES.map((s) => (
                        <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Page</Label>
                  <Input
                    type="number"
                    min={1}
                    value={voiceCdrPage}
                    onChange={(e) => setVoiceCdrPage(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>
                <div>
                  <Label>Direction</Label>
                  <Select
                    value={voiceCdrDirection}
                    onValueChange={(v: "inbound" | "outbound" | "both") => setVoiceCdrDirection(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Both</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => loadVoiceCdr()} disabled={voiceCdrLoading}>
                {voiceCdrLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</> : "Fetch Voice CDR"}
              </Button>
              {voiceCdrData && (
                <div className="rounded-md border border-slate-800 overflow-x-auto">
                  <p className="text-sm text-slate-400 mb-2">Total: {voiceCdrData.count} records (showing page {voiceCdrPage})</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>calldate</TableHead>
                        <TableHead>from</TableHead>
                        <TableHead>to</TableHead>
                        <TableHead>secs_call</TableHead>
                        <TableHead>chg_total</TableHead>
                        <TableHead>trunk</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {voiceCdrData.data.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{String((row as Record<string, unknown>).calldate ?? "—")}</TableCell>
                          <TableCell>{String((row as Record<string, unknown>).from ?? "—")}</TableCell>
                          <TableCell>{String((row as Record<string, unknown>).to ?? "—")}</TableCell>
                          <TableCell>{String((row as Record<string, unknown>).secs_call ?? "—")}</TableCell>
                          <TableCell>{String((row as Record<string, unknown>).chg_total ?? "—")}</TableCell>
                          <TableCell>{String((row as Record<string, unknown>).trunk ?? "—")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between items-center p-2 border-t border-slate-800">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={voiceCdrPage <= 1 || voiceCdrLoading}
                      onClick={() => loadVoiceCdr(Math.max(1, voiceCdrPage - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-slate-400">Page {voiceCdrPage}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={voiceCdrData.data.length < voiceCdrSize || voiceCdrLoading}
                      onClick={() => loadVoiceCdr(voiceCdrPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS CDR Tab */}
        <TabsContent value="sms-cdr" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                SMS CDR
              </CardTitle>
              <CardDescription>Fetch latest SMS CDR report, then view records with pagination.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <Label>Quantity</Label>
                  <Select
                    value={smsCdrQuantity.toString()}
                    onValueChange={(v) => setSmsCdrQuantity(Number(v))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="1000">1000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={loadSmsCdr} disabled={smsCdrLoading}>
                  {smsCdrLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</> : "Fetch SMS CDR"}
                </Button>
              </div>
              {smsCdrData.length > 0 && (
                <div className="rounded-md border border-slate-800 overflow-x-auto">
                  <p className="text-sm text-slate-400 mb-2">
                    Showing {(smsCdrPage - 1) * SMS_CDR_PAGE_SIZE + 1}–{Math.min(smsCdrPage * SMS_CDR_PAGE_SIZE, smsCdrData.length)} of {smsCdrData.length}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>calldate</TableHead>
                        <TableHead>from</TableHead>
                        <TableHead>to</TableHead>
                        <TableHead>chg_total</TableHead>
                        <TableHead>currency</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {smsCdrData
                        .slice((smsCdrPage - 1) * SMS_CDR_PAGE_SIZE, smsCdrPage * SMS_CDR_PAGE_SIZE)
                        .map((row, i) => (
                          <TableRow key={i}>
                            <TableCell>{String((row as Record<string, unknown>).calldate ?? "—")}</TableCell>
                            <TableCell>{String((row as Record<string, unknown>).from ?? "—")}</TableCell>
                            <TableCell>{String((row as Record<string, unknown>).to ?? "—")}</TableCell>
                            <TableCell>{String((row as Record<string, unknown>).chg_total ?? "—")}</TableCell>
                            <TableCell>{String((row as Record<string, unknown>).currency ?? "—")}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between items-center p-2 border-t border-slate-800">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={smsCdrPage <= 1}
                      onClick={() => setSmsCdrPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-slate-400">
                      Page {smsCdrPage} of {Math.ceil(smsCdrData.length / SMS_CDR_PAGE_SIZE) || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={smsCdrPage >= Math.ceil(smsCdrData.length / SMS_CDR_PAGE_SIZE)}
                      onClick={() => setSmsCdrPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channel-utilisation" className="space-y-4">
          {activeTab === "channel-utilisation" ? <ChannelUtilisationCard /> : null}
        </TabsContent>

        <TabsContent value="porting-dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Port In</CardTitle>
              <CardDescription>
                View combined local and mobile porting requests from SIMWOOD /v3/porting/{`{account}`}/ports and /mnp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p>
                    <p className="text-2xl font-semibold text-white">{portingDashboardRows.length}</p>
                    <p className="text-[11px] text-slate-500 mt-1">All loaded requests</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Rejected</p>
                    <p className="text-2xl font-semibold text-red-300">{portingRejectedCount}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Rejected by provider flow</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Accepted</p>
                    <p className="text-2xl font-semibold text-blue-300">{portingAcceptedCount}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Ready/approved requests</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Completed</p>
                    <p className="text-2xl font-semibold text-emerald-300">{portingCompletedCount}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Finished requests</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Submitted</p>
                    <p className="text-2xl font-semibold text-amber-300">{portingSubmittedCount}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Sent to LCP/RH</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Pending/Received</p>
                    <p className="text-2xl font-semibold text-slate-200">{portingPendingCount}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Awaiting progress</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  placeholder="Search number or reference"
                  value={portingSearch}
                  onChange={(e) => setPortingSearch(e.target.value)}
                />
                <Select value={portingStatusFilter} onValueChange={setPortingStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {portingStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {getPortingStatusLabel(status)}
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <input
                    id="upcoming-accepted-only"
                    type="checkbox"
                    checked={portingUpcomingAcceptedOnly}
                    onChange={(e) => setPortingUpcomingAcceptedOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                  />
                  <Label htmlFor="upcoming-accepted-only">Upcoming accepted (CRD &gt;= today)</Label>
                </div>
              </div>

              <div>
                <Button onClick={loadPortingDashboard} disabled={portingDashboardLoading}>
                  {portingDashboardLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="text-base">
                        Accepted{" "}
                        <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          CRD Today
                        </span>
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            acceptedTodayRows.length === 0 ||
                            portingAssocSectionLoading[PORTING_DASHBOARD_ASSOC_SECTION.acceptedToday] ||
                            !acceptedTodayRows.some(portingRowNeedsAssociatedFetch)
                          }
                          onClick={() =>
                            void loadPortingAssociatedForSection(
                              acceptedTodayRows,
                              PORTING_DASHBOARD_ASSOC_SECTION.acceptedToday
                            )
                          }
                        >
                          {portingAssocSectionLoading[PORTING_DASHBOARD_ASSOC_SECTION.acceptedToday] ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Show associated
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!portingSectionHasNumbersToCopy(acceptedTodayRows)}
                          onClick={() => copySectionNumbers(acceptedTodayRows, "Accepted - today")}
                        >
                          Copy numbers
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{acceptedTodayRows.length} requests</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ref</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead>Associated</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>CRD</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {acceptedTodayRows.slice(0, 8).map((row) => (
                          <TableRow key={`today-${row.ref}`}>
                            <TableCell>{row.ref}</TableCell>
                            <TableCell>{row.mbn}</TableCell>
                            <TableCell className="max-w-[200px] whitespace-normal break-all">
                              {renderPortingAssociatedCell(row)}
                            </TableCell>
                            <TableCell>{formatDateOnly(row.date)}</TableCell>
                            <TableCell>{formatDateOnly(row.crd)}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${getPortingStatusClass(getPortingStatusKey(row))}`}>
                                {getPortingStatusLabel(getPortingStatusKey(row))}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        {acceptedTodayRows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-slate-400">
                              No accepted requests for today.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="text-base">
                        Accepted{" "}
                        <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          CRD Tomorrow
                        </span>
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            acceptedTomorrowRows.length === 0 ||
                            portingAssocSectionLoading[PORTING_DASHBOARD_ASSOC_SECTION.acceptedTomorrow] ||
                            !acceptedTomorrowRows.some(portingRowNeedsAssociatedFetch)
                          }
                          onClick={() =>
                            void loadPortingAssociatedForSection(
                              acceptedTomorrowRows,
                              PORTING_DASHBOARD_ASSOC_SECTION.acceptedTomorrow
                            )
                          }
                        >
                          {portingAssocSectionLoading[PORTING_DASHBOARD_ASSOC_SECTION.acceptedTomorrow] ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Show associated
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!portingSectionHasNumbersToCopy(acceptedTomorrowRows)}
                          onClick={() => copySectionNumbers(acceptedTomorrowRows, "Accepted - tomorrow")}
                        >
                          Copy numbers
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{acceptedTomorrowRows.length} requests</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ref</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead>Associated</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>CRD</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {acceptedTomorrowRows.slice(0, 8).map((row) => (
                          <TableRow key={`tomorrow-${row.ref}`}>
                            <TableCell>{row.ref}</TableCell>
                            <TableCell>{row.mbn}</TableCell>
                            <TableCell className="max-w-[200px] whitespace-normal break-all">
                              {renderPortingAssociatedCell(row)}
                            </TableCell>
                            <TableCell>{formatDateOnly(row.date)}</TableCell>
                            <TableCell>{formatDateOnly(row.crd)}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${getPortingStatusClass(getPortingStatusKey(row))}`}>
                                {getPortingStatusLabel(getPortingStatusKey(row))}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        {acceptedTomorrowRows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-slate-400">
                              No accepted requests for tomorrow.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="text-base">
                        Completed{" "}
                        <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          CRD Yesterday
                        </span>
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            completedYesterdayRows.length === 0 ||
                            portingAssocSectionLoading[PORTING_DASHBOARD_ASSOC_SECTION.completedYesterday] ||
                            !completedYesterdayRows.some(portingRowNeedsAssociatedFetch)
                          }
                          onClick={() =>
                            void loadPortingAssociatedForSection(
                              completedYesterdayRows,
                              PORTING_DASHBOARD_ASSOC_SECTION.completedYesterday
                            )
                          }
                        >
                          {portingAssocSectionLoading[PORTING_DASHBOARD_ASSOC_SECTION.completedYesterday] ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Show associated
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!portingSectionHasNumbersToCopy(completedYesterdayRows)}
                          onClick={() => copySectionNumbers(completedYesterdayRows, "Completed - yesterday")}
                        >
                          Copy numbers
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{completedYesterdayRows.length} requests</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ref</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead>Associated</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>CRD</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {completedYesterdayRows.slice(0, 8).map((row) => (
                          <TableRow key={`completed-yesterday-${row.ref}`}>
                            <TableCell>{row.ref}</TableCell>
                            <TableCell>{row.mbn}</TableCell>
                            <TableCell className="max-w-[200px] whitespace-normal break-all">
                              {renderPortingAssociatedCell(row)}
                            </TableCell>
                            <TableCell>{formatDateOnly(row.date)}</TableCell>
                            <TableCell>{formatDateOnly(row.crd)}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${getPortingStatusClass(getPortingStatusKey(row))}`}>
                                {getPortingStatusLabel(getPortingStatusKey(row))}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        {completedYesterdayRows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-slate-400">
                              No completed requests for yesterday.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="text-base">
                        Completed{" "}
                        <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          CRD Today
                        </span>
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            completedTodayRows.length === 0 ||
                            portingAssocSectionLoading[PORTING_DASHBOARD_ASSOC_SECTION.completedToday] ||
                            !completedTodayRows.some(portingRowNeedsAssociatedFetch)
                          }
                          onClick={() =>
                            void loadPortingAssociatedForSection(
                              completedTodayRows,
                              PORTING_DASHBOARD_ASSOC_SECTION.completedToday
                            )
                          }
                        >
                          {portingAssocSectionLoading[PORTING_DASHBOARD_ASSOC_SECTION.completedToday] ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Show associated
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!portingSectionHasNumbersToCopy(completedTodayRows)}
                          onClick={() => copySectionNumbers(completedTodayRows, "Completed - today")}
                        >
                          Copy numbers
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{completedTodayRows.length} requests</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ref</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead>Associated</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>CRD</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {completedTodayRows.slice(0, 8).map((row) => (
                          <TableRow key={`completed-today-${row.ref}`}>
                            <TableCell>{row.ref}</TableCell>
                            <TableCell>{row.mbn}</TableCell>
                            <TableCell className="max-w-[200px] whitespace-normal break-all">
                              {renderPortingAssociatedCell(row)}
                            </TableCell>
                            <TableCell>{formatDateOnly(row.date)}</TableCell>
                            <TableCell>{formatDateOnly(row.crd)}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${getPortingStatusClass(getPortingStatusKey(row))}`}>
                                {getPortingStatusLabel(getPortingStatusKey(row))}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        {completedTodayRows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-slate-400">
                              No completed requests for today.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300 font-medium">All porting requests</p>
                <p className="text-xs text-slate-400">
                  Showing {portingShowingStart}-{portingShowingEnd} of {portingFilteredRows.length}
                </p>
              </div>
              <div className="rounded-md border border-slate-800 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Associated</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>CRD</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portingPaginatedRows.map((row) => (
                      <TableRow key={`porting-${row.portKind}-${row.ref}-${row.mbn}`}>
                        <TableCell>{row.ref}</TableCell>
                        <TableCell>{row.mbn}</TableCell>
                        <TableCell className="max-w-[220px] whitespace-normal break-all">
                          {renderPortingAssociatedCell(row)}
                        </TableCell>
                        <TableCell>{formatDateOnly(row.date)}</TableCell>
                        <TableCell>{formatDateOnly(row.crd)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${getPortingStatusClass(getPortingStatusKey(row))}`}>
                            {getPortingStatusLabel(getPortingStatusKey(row))}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!portingDashboardLoading && portingPaginatedRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-slate-400">
                          No matching porting requests.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {portingTotalPages > 1 && (
                <div className="flex justify-between items-center p-2 border border-slate-800 rounded-md">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={portingPage <= 1}
                    onClick={() => setPortingPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-slate-400">
                    Page {portingPage} of {portingTotalPages} ({portingFilteredRows.length} results)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={portingPage >= portingTotalPages}
                    onClick={() => setPortingPage((page) => page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>

        {/* Attach Trunk Dialog */}
        <Dialog open={showTrunkDialog} onOpenChange={setShowTrunkDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Attach Number to Trunk</DialogTitle>
              <DialogDescription>
                Select a trunk to attach number <strong>{selectedNumber}</strong> to.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="trunk-select">Trunk</Label>
                {trunksLoading ? (
                  <Skeleton className="h-10 w-full mt-2" />
                ) : (
                  <Select value={selectedTrunk} onValueChange={setSelectedTrunk}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a trunk" />
                    </SelectTrigger>
                    <SelectContent>
                      {trunks.map((trunk) => (
                        <SelectItem key={trunk.trunk} value={trunk.trunk}>
                          {trunk.trunk}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowTrunkDialog(false);
                  setSelectedNumber(null);
                  setSelectedCountryCode(null);
                  setSelectedTrunk("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={confirmAttachTrunk} disabled={attachingTrunk || !selectedTrunk}>
                {attachingTrunk ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Attaching...
                  </>
                ) : (
                  "Confirm"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Configure Number Dialog */}
        <Dialog open={showConfigureDialog} onOpenChange={(open) => { if (!open) setConfigureNumber(null); setShowConfigureDialog(open); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configure number {configureNumber} {configureCountryCode ? `(+${configureCountryCode})` : ""}</DialogTitle>
              <DialogDescription>Current trunk is loaded from the API when you open this dialog. You can also attach to a different trunk, set emergency 999, SMS, reset config, or delete.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Current trunk (from API) + Attach */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Link2 className="h-4 w-4" /> Trunk
                </h4>
                {currentTrunkLoading ? (
                  <Skeleton className="h-8 w-full" />
                ) : (
                  <div className="rounded-md bg-slate-800/60 border border-slate-700 px-3 py-2">
                    <p className="text-xs text-slate-400">Attached trunk (from API)</p>
                    <p className="text-sm font-medium text-white mt-0.5">{currentTrunk ?? "—"}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  {trunksLoading ? (
                    <Skeleton className="h-10 flex-1" />
                  ) : (
                    <Select value={configureTrunk} onValueChange={setConfigureTrunk}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select trunk to attach" />
                      </SelectTrigger>
                      <SelectContent>
                        {trunks.map((t) => (
                          <SelectItem key={t.trunk} value={t.trunk}>{t.trunk}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    onClick={async () => {
                      if (!configureNumber || !configureTrunk) return;
                      const ok = await doAttachTrunk(configureNumber, configureCountryCode, configureTrunk);
                      if (ok) setConfigureTrunk("");
                    }}
                    disabled={attachingTrunk || !configureTrunk}
                    size="sm"
                  >
                    {attachingTrunk ? <Loader2 className="h-4 w-4 animate-spin" /> : "Attach"}
                  </Button>
                </div>
              </div>

              {/* Emergency 999 */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Emergency 999
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {EMERGENCY999_FIELDS.map((field) => (
                    <div key={field}>
                      <Label className="text-xs capitalize">{field}</Label>
                      <Input
                        className="mt-0.5"
                        value={emergency999Form[field]}
                        onChange={(e) => setEmergency999Form((f) => ({ ...f, [field]: e.target.value }))}
                        placeholder={field}
                      />
                    </div>
                  ))}
                </div>
                <Button size="sm" onClick={submitEmergency999} disabled={emergency999Loading}>
                  {emergency999Loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save 999 details"}
                </Button>
              </div>

              {/* SMS config – only for non-fixed numbers */}
              {configureNumberTypeLoading ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> SMS (mode: http_json)
                  </h4>
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : configureNumberType !== "fixed" && configureNumberType != null ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> SMS (mode: http_json)
                  </h4>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://your-inbound-sms-url.com"
                      value={smsEndpoint}
                      onChange={(e) => setSmsEndpoint(e.target.value)}
                    />
                    <Button size="sm" onClick={submitSmsConfig} disabled={smsConfigLoading}>
                      {smsConfigLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save SMS"}
                    </Button>
                  </div>
                </div>
              ) : configureNumberType === "fixed" ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2 text-slate-500">
                    <MessageSquare className="h-4 w-4" /> SMS
                  </h4>
                  <p className="text-sm text-slate-500">SMS configuration is not available for fixed line numbers.</p>
                </div>
              ) : null}

              {/* Reset config */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" /> Reset configuration
                </h4>
                {!resetConfigConfirmOpen ? (
                  <Button variant="outline" size="sm" onClick={() => setResetConfigConfirmOpen(true)}>
                    Reset number configuration
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">This will reset the number configuration. Continue?</span>
                    <Button variant="outline" size="sm" onClick={() => setResetConfigConfirmOpen(false)}>Cancel</Button>
                    <Button variant="destructive" size="sm" onClick={confirmResetConfig} disabled={resetConfigLoading}>
                      {resetConfigLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, reset"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Delete number */}
              <div className="space-y-2 border-t border-slate-700 pt-4">
                <h4 className="text-sm font-medium flex items-center gap-2 text-red-400">
                  <Trash2 className="h-4 w-4" /> Delete number
                </h4>
                {!deleteConfirmOpen ? (
                  <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
                    Permanently delete this number
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-400">This will permanently remove the number. You will lose the number. Continue?</span>
                    <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                    <Button variant="destructive" size="sm" onClick={confirmDeleteNumber} disabled={deleteNumberLoading}>
                      {deleteNumberLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, delete"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RouteProtection>
  );
}
