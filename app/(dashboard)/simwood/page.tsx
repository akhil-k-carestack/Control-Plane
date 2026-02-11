"use client";

import { useState, useEffect } from "react";
import { RouteProtection } from "@/components/route-protection";
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

  const loadMyNumbers = async () => {
    try {
      setMyNumbersLoading(true);
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
                  <Button onClick={loadMyNumbers} disabled={myNumbersLoading}>
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
                              <TableCell>{num.country_code}</TableCell>
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
                            <TableCell className="text-slate-300">{(num as Record<string, unknown>).type ?? num.bill_class ?? "—"}</TableCell>
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
                            <TableCell className="text-slate-300">{(num as Record<string, unknown>).type ?? num.bill_class ?? "—"}</TableCell>
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
