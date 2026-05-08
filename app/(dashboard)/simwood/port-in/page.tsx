"use client";

import { useEffect, useState, type ChangeEvent } from "react";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type PortInNumberType = "local" | "mobile";

interface PortInEntry {
  rowId: string;
  rowNumber: number;
  number: string;
  numberType: PortInNumberType;
  mainBillingNumber: string;
  accountNumber: string;
  currentProvider: string;
  lcpCupid: string;
  numberOfLines: string;
  numberOfChannels: string;
  installationFirstName: string;
  installationLastName: string;
  installationProperty: string;
  installationStreet: string;
  installationTownCity: string;
  installationPostcode: string;
  associatedNumbers: string;
  contactEmail: string;
  lineType: string;
  pac: string;
  payload: Record<string, string>;
}

interface PortInResult {
  rowId: string;
  number: string;
  ref: string;
  mbn: string;
  date: string;
  status: string;
  error?: string;
}

export default function SimwoodPortInPage() {
  const [entries, setEntries] = useState<PortInEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [results, setResults] = useState<PortInResult[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [entrySearch, setEntrySearch] = useState("");
  const [entryTypeFilter, setEntryTypeFilter] = useState<"all" | PortInNumberType>("all");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [entryPage, setEntryPage] = useState(1);
  const ENTRY_PAGE_SIZE = 10;

  const normalizeHeader = (value: string): string =>
    value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

  const getCellString = (value: unknown): string => {
    if (value == null) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
    return "";
  };

  const getFromAliases = (row: Record<string, string>, aliases: string[]): string => {
    for (const alias of aliases) {
      const normalizedAlias = normalizeHeader(alias);
      const matched = Object.entries(row).find(([key]) => normalizeHeader(key) === normalizedAlias);
      if (matched && matched[1].trim()) return matched[1].trim();
    }
    return "";
  };

  const toNumberType = (value: string): PortInNumberType | null => {
    const normalized = value.trim().toLowerCase();
    if (["mobile", "cell"].includes(normalized)) return "mobile";
    if (["local", "landline", "fixed"].includes(normalized)) return "local";
    return null;
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setEntries([]);
    setSelectedIds([]);
    setResults([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.SheetNames[0];

      if (!firstSheet) throw new Error("Excel file does not contain any sheet");

      const worksheet = workbook.Sheets[firstSheet];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: "",
        raw: false,
      });

      if (rawRows.length === 0) throw new Error("No data rows found in the uploaded file");

      const parsedEntries: PortInEntry[] = [];
      const rowErrors: string[] = [];

      rawRows.forEach((rawRow, index) => {
        const row = Object.fromEntries(
          Object.entries(rawRow).map(([key, value]) => [key, getCellString(value)])
        );

        const number = getFromAliases(row, ["number", "msisdn", "telephone", "phone"]);
        const typeValue = getFromAliases(row, ["type", "numberType", "number_type"]);
        const mainBillingNumber = getFromAliases(row, ["mainBillingNumber", "mainBillingNo", "mbn", "billingNumber"]);
        const accountNumber = getFromAliases(row, ["accountNumber", "account", "losingAccount"]);
        const currentProvider = getFromAliases(row, ["currentProvider", "operator", "donor", "donorOperator", "currentOperator"]);
        const lcpCupid = getFromAliases(row, ["lcpCupid", "lcp_cupid", "lcpCUPID", "cupid", "LCP CUPID"]);
        const numberOfLines = getFromAliases(row, ["numberOfLines", "lines", "lineCount"]);
        const numberOfChannels = getFromAliases(row, ["numberOfChannels", "channels", "channelCount"]);
        const installationFirstName = getFromAliases(row, ["installationFirstName", "firstName", "installFirstName"]);
        const installationLastName = getFromAliases(row, ["installationLastName", "lastName", "installLastName"]);
        const installationProperty = getFromAliases(row, ["installationPropertyNameNumber", "propertyNameNumber", "installationProperty", "property"]);
        const installationStreet = getFromAliases(row, ["installationStreet", "street", "addressLine1"]);
        const installationTownCity = getFromAliases(row, ["installationTownCity", "townCity", "city", "town"]);
        const installationPostcode = getFromAliases(row, ["installationPostcode", "postcode", "zip", "postalCode"]);
        const associatedNumbers = getFromAliases(row, ["associatedNumbers", "associateNumbers", "associated"]);
        const contactEmail = getFromAliases(row, ["contactEmail", "email", "contact"]);
        const lineType = getFromAliases(row, ["lineType", "singleOrMultiline", "singleLineOrMultiline"]);
        const pac = getFromAliases(row, ["pac", "portingAuthorisationCode", "portingAuthorizationCode"]);
        const numberType = toNumberType(typeValue);
        const rowNumber = index + 2;

        if (!number) rowErrors.push(`Row ${rowNumber}: Number is required`);
        if (!numberType) rowErrors.push(`Row ${rowNumber}: Type must be 'local' or 'mobile'`);
        if (numberType === "mobile" && !pac) rowErrors.push(`Row ${rowNumber}: PAC is required for mobile`);
        if (numberType === "local") {
          if (!mainBillingNumber) rowErrors.push(`Row ${rowNumber}: Main Billing Number is required for local`);
          if (!currentProvider) rowErrors.push(`Row ${rowNumber}: Current Provider is required for local`);
          if (!lcpCupid) rowErrors.push(`Row ${rowNumber}: LCP CUPID is required for local (use SIMWOOD GET /v3/porting/your-account/lcps)`);
          if (!accountNumber) rowErrors.push(`Row ${rowNumber}: Account Number is required for local`);
          if (!numberOfLines) rowErrors.push(`Row ${rowNumber}: Number of Lines is required for local`);
          if (!numberOfChannels) rowErrors.push(`Row ${rowNumber}: Number of Channels is required for local`);
          if (!installationFirstName) rowErrors.push(`Row ${rowNumber}: Installation First Name is required for local`);
          if (!installationLastName) rowErrors.push(`Row ${rowNumber}: Installation Last Name is required for local`);
          if (!installationProperty) rowErrors.push(`Row ${rowNumber}: Installation Property Name/Number is required for local`);
          if (!installationStreet) rowErrors.push(`Row ${rowNumber}: Installation Street is required for local`);
          if (!installationTownCity) rowErrors.push(`Row ${rowNumber}: Installation Town/City is required for local`);
          if (!installationPostcode) rowErrors.push(`Row ${rowNumber}: Installation Postcode is required for local`);
          if (!contactEmail) rowErrors.push(`Row ${rowNumber}: Contact Email is required for local`);
        }

        const isValidMobile = number && numberType === "mobile" && pac;
        const isValidLocal =
          number &&
          numberType === "local" &&
          mainBillingNumber &&
          currentProvider &&
          lcpCupid &&
          accountNumber &&
          numberOfLines &&
          numberOfChannels &&
          installationFirstName &&
          installationLastName &&
          installationProperty &&
          installationStreet &&
          installationTownCity &&
          installationPostcode &&
          contactEmail &&
          true;

        if (isValidMobile || isValidLocal) {
          parsedEntries.push({
            rowId: crypto.randomUUID(),
            rowNumber,
            number,
            numberType,
            mainBillingNumber,
            accountNumber,
            currentProvider,
            lcpCupid,
            numberOfLines,
            numberOfChannels,
            installationFirstName,
            installationLastName,
            installationProperty,
            installationStreet,
            installationTownCity,
            installationPostcode,
            associatedNumbers,
            contactEmail,
            lineType,
            pac,
            payload: row,
          });
        }
      });

      if (rowErrors.length > 0) {
        const preview = rowErrors.slice(0, 10).join(" | ");
        throw new Error(
          rowErrors.length > 10
            ? `${preview} | ...and ${rowErrors.length - 10} more validation errors`
            : preview
        );
      }

      setEntries(parsedEntries);
      setSelectedIds(parsedEntries.map((entry) => entry.rowId));
      toast.success(`Loaded ${parsedEntries.length} valid port-in entries`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to parse file";
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const toggleSelection = (rowId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(rowId) ? prev : [...prev, rowId];
      return prev.filter((id) => id !== rowId);
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? entries.map((entry) => entry.rowId) : []);
  };

  useEffect(() => {
    setEntryPage(1);
  }, [entrySearch, entryTypeFilter, showSelectedOnly, entries.length, selectedIds.length]);

  const initiatePorting = async () => {
    const selectedEntries = entries.filter((entry) => selectedIds.includes(entry.rowId));
    if (selectedEntries.length === 0) {
      toast.error("Select at least one row to initiate porting");
      return;
    }

    try {
      setProcessing(true);
      setResults([]);

      const response = await fetch("/api/simwood/port-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: selectedEntries }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process port-in requests");
      }

      const result = (await response.json()) as { results?: PortInResult[] };
      const rows = Array.isArray(result.results) ? result.results : [];
      setResults(rows);

      const failed = rows.filter((row) => row.status.toLowerCase() === "failed").length;
      const successful = rows.length - failed;
      toast.success(`Porting completed. Success: ${successful}, Failed: ${failed}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process port-in requests");
    } finally {
      setProcessing(false);
    }
  };

  const localEntriesCount = entries.filter((entry) => entry.numberType === "local").length;
  const mobileEntriesCount = entries.filter((entry) => entry.numberType === "mobile").length;
  const selectedEntries = entries.filter((entry) => selectedIds.includes(entry.rowId));
  const selectedLocalCount = selectedEntries.filter((entry) => entry.numberType === "local").length;
  const selectedMobileCount = selectedEntries.filter((entry) => entry.numberType === "mobile").length;
  const failedResultsCount = results.filter((row) => row.status.toLowerCase() === "failed").length;
  const successfulResultsCount = results.length - failedResultsCount;

  const filteredEntries = entries.filter((entry) => {
    if (showSelectedOnly && !selectedIds.includes(entry.rowId)) return false;
    if (entryTypeFilter !== "all" && entry.numberType !== entryTypeFilter) return false;
    const search = entrySearch.trim().toLowerCase();
    if (!search) return true;
    return (
      entry.number.toLowerCase().includes(search) ||
      entry.mainBillingNumber.toLowerCase().includes(search) ||
      entry.accountNumber.toLowerCase().includes(search) ||
      entry.currentProvider.toLowerCase().includes(search) ||
      entry.contactEmail.toLowerCase().includes(search) ||
      entry.pac.toLowerCase().includes(search)
    );
  });
  const entryTotalPages = Math.ceil(filteredEntries.length / ENTRY_PAGE_SIZE) || 1;
  const paginatedEntries = filteredEntries.slice(
    (entryPage - 1) * ENTRY_PAGE_SIZE,
    entryPage * ENTRY_PAGE_SIZE
  );

  return (
    <RouteProtection>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Port In Numbers</h1>
          <p className="text-slate-400 mt-2">Upload and initiate number port-in requests</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Bulk upload from Excel</CardTitle>
              <CardDescription>
                Upload an Excel file, validate entries, choose rows, then manually initiate porting.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/simwood/port-in-template.xlsx" download>
                Download Example File
              </a>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-800 bg-slate-900/40 p-3">
              <p className="text-sm text-slate-200 font-medium">Flow</p>
              <p className="text-xs text-slate-400 mt-1">
                1) Upload file → 2) Review and select rows → 3) Initiate porting → 4) Check result references and statuses.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="port-in-file">Upload Excel (.xlsx / .xls)</Label>
              <Input
                id="port-in-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploading || processing}
              />
              <p className="text-xs text-slate-400">
                For local/geographic: Number, Main Billing Number, Account Number, Current Provider, LCP CUPID (from SIMWOOD GET /v3/porting/your-account/lcps), Number of Lines, Number of Channels, Installation Address details, Contact Email. Line Type and Associated Numbers are optional. For mobile: Number and PAC are required.
              </p>
            </div>

            {uploading && (
              <div className="flex items-center text-sm text-slate-300">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validating uploaded file...
              </div>
            )}

            {uploadError && (
              <div className="rounded-md border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                {uploadError}
              </div>
            )}

            {entries.length > 0 && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-400">Total Rows</p>
                      <p className="text-xl font-semibold text-white">{entries.length}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-400">Local</p>
                      <p className="text-xl font-semibold text-white">{localEntriesCount}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-400">Mobile</p>
                      <p className="text-xl font-semibold text-white">{mobileEntriesCount}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-400">Selected</p>
                      <p className="text-xl font-semibold text-white">{selectedIds.length}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {selectedLocalCount} local / {selectedMobileCount} mobile
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    placeholder="Search number, account, provider, email, PAC..."
                    value={entrySearch}
                    onChange={(e) => setEntrySearch(e.target.value)}
                  />
                  <select
                    value={entryTypeFilter}
                    onChange={(e) => setEntryTypeFilter(e.target.value as "all" | PortInNumberType)}
                    className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                  >
                    <option value="all">All types</option>
                    <option value="local">Local</option>
                    <option value="mobile">Mobile</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={showSelectedOnly}
                      onChange={(e) => setShowSelectedOnly(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                    />
                    Show selected only
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-300">
                    {selectedIds.length} of {entries.length} selected ({filteredEntries.length} shown by filter)
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      id="port-in-select-all"
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === entries.length}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      disabled={processing}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                    />
                    <Label htmlFor="port-in-select-all">Select All</Label>
                  </div>
                </div>

                <div className="rounded-md border border-slate-800 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Select</TableHead>
                        <TableHead>Row</TableHead>
                        <TableHead>Number</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Main Billing</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>LCP CUPID</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Lines/Channels</TableHead>
                        <TableHead>Installation Address</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Line Type</TableHead>
                        <TableHead>Associated Numbers</TableHead>
                        <TableHead>PAC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEntries.map((entry) => {
                        const checked = selectedIds.includes(entry.rowId);
                        return (
                          <TableRow key={entry.rowId}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleSelection(entry.rowId, e.target.checked)}
                                disabled={processing}
                                className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                              />
                            </TableCell>
                            <TableCell>{entry.rowNumber}</TableCell>
                            <TableCell className="font-medium">{entry.number}</TableCell>
                            <TableCell>
                              <span className={entry.numberType === "mobile" ? "text-cyan-300" : "text-amber-300"}>
                                {entry.numberType}
                              </span>
                            </TableCell>
                            <TableCell>{entry.mainBillingNumber || "—"}</TableCell>
                            <TableCell>{entry.currentProvider || "—"}</TableCell>
                            <TableCell>{entry.lcpCupid || "—"}</TableCell>
                            <TableCell>{entry.accountNumber}</TableCell>
                            <TableCell>{entry.numberOfLines || "—"}/{entry.numberOfChannels || "—"}</TableCell>
                            <TableCell>
                              {entry.installationFirstName || entry.installationLastName
                                ? `${entry.installationFirstName} ${entry.installationLastName}, ${entry.installationProperty}, ${entry.installationStreet}, ${entry.installationTownCity}, ${entry.installationPostcode}`
                                : "—"}
                            </TableCell>
                            <TableCell>{entry.contactEmail || "—"}</TableCell>
                            <TableCell>{entry.lineType || "—"}</TableCell>
                            <TableCell>{entry.associatedNumbers || "—"}</TableCell>
                            <TableCell>{entry.pac || "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {entryTotalPages > 1 && (
                  <div className="flex justify-between items-center p-2 border border-slate-800 rounded-md">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={entryPage <= 1}
                      onClick={() => setEntryPage((page) => Math.max(1, page - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-slate-400">
                      Page {entryPage} of {entryTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={entryPage >= entryTotalPages}
                      onClick={() => setEntryPage((page) => page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={initiatePorting} disabled={processing || selectedIds.length === 0}>
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Initiating Porting...
                      </>
                    ) : (
                      "Initiate Porting"
                    )}
                  </Button>
                </div>
              </>
            )}

            {results.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-400">Successful</p>
                      <p className="text-xl font-semibold text-emerald-400">{successfulResultsCount}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-400">Failed</p>
                      <p className="text-xl font-semibold text-red-400">{failedResultsCount}</p>
                    </CardContent>
                  </Card>
                </div>
                <h4 className="text-sm font-medium">Porting Request Results</h4>
                <div className="rounded-md border border-slate-800 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Number</TableHead>
                        <TableHead>Ref</TableHead>
                        <TableHead>MBN</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((result) => (
                        <TableRow key={result.rowId}>
                          <TableCell className="font-medium">{result.number}</TableCell>
                          <TableCell>{result.ref || "—"}</TableCell>
                          <TableCell>{result.mbn || "—"}</TableCell>
                          <TableCell>{result.date || "—"}</TableCell>
                          <TableCell className={result.status.toLowerCase() === "failed" ? "text-red-400" : "text-emerald-400"}>
                            {result.status}
                            {result.error ? ` (${result.error})` : ""}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RouteProtection>
  );
}
