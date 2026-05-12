"use client";

import { useState, useEffect } from "react";
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
import { RouteProtection } from "@/components/route-protection";
import { toast } from "sonner";
import { Loader2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUDIT_LOG_ACTIONS } from "@/lib/constants";

interface AuditLog {
  id: number;
  action: string;
  payload: string | null;
  doneBy: string;
  requestId: string;
  username?: string;
  region: string;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"username" | "createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchUsername, setSearchUsername] = useState("");
  const [filterAction, setFilterAction] = useState("all");

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      // Ensure we always send limit=10
      const currentPage = pagination.page || 1;
      const currentLimit = pagination.limit || 10;
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: currentLimit.toString(),
        sortBy,
        sortOrder,
      });
      
      // Debug logging (remove in production)
      console.log("Fetching audit logs - Page:", currentPage, "Limit:", currentLimit);

      if (searchUsername) {
        params.append("searchUsername", searchUsername);
      }

      if (filterAction && filterAction !== "all") {
        params.append("filterAction", filterAction);
      }

      const response = await fetch(`/api/audit-logs?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch audit logs");
      }

      setAuditLogs(result.data);
      setPagination(result.pagination);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch audit logs"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [searchUsername, filterAction]);

  // Fetch data when pagination, sort, or filters change
  useEffect(() => {
    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, sortBy, sortOrder, searchUsername, filterAction]);

  const handleSort = (field: "username" | "createdAt") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatPayload = (payload: string | null) => {
    if (!payload) return "N/A";
    try {
      const parsed = JSON.parse(payload);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return payload;
    }
  };

  const SortIcon = ({ field }: { field: "username" | "createdAt" }) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  return (
    <RouteProtection>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Audit Logs</h1>
          <p className="text-slate-400 mt-2">
            View all system audit logs and user activities
          </p>
        </div>

        <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
          <CardHeader>
            <CardTitle>Audit Log Entries</CardTitle>
            <CardDescription>
              Showing {auditLogs.length} of {pagination.total} entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search and Filter Section */}
            <div className="mb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Username Search */}
                <div className="space-y-2">
                  <Label htmlFor="search-username" className="text-slate-300">
                    Search by Username
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="search-username"
                      type="text"
                      placeholder="Enter username or email..."
                      value={searchUsername}
                      onChange={(e) => setSearchUsername(e.target.value)}
                      className="pl-10 pr-10 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-blue-500"
                    />
                    {searchUsername && (
                      <button
                        onClick={() => setSearchUsername("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Action Filter */}
                <div className="space-y-2">
                  <Label htmlFor="filter-action" className="text-slate-300">
                    Filter by Action
                  </Label>
                  <Select value={filterAction} onValueChange={setFilterAction}>
                    <SelectTrigger
                      id="filter-action"
                      className="bg-slate-800 border-slate-700 text-slate-200"
                    >
                      <SelectValue placeholder="All Actions" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem
                        value="all"
                        className="text-slate-200 hover:bg-slate-700 focus:bg-slate-700"
                      >
                        All Actions
                      </SelectItem>
                      {Object.values(AUDIT_LOG_ACTIONS).map((action: string) => (
                        <SelectItem
                          key={action}
                          value={action}
                          className="text-slate-200 hover:bg-slate-700 focus:bg-slate-700"
                        >
                          {action}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Active Filters Display */}
              {(searchUsername || (filterAction && filterAction !== "all")) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-slate-400">Active filters:</span>
                  {searchUsername && (
                    <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-medium flex items-center gap-1">
                      Username: {searchUsername}
                      <button
                        onClick={() => setSearchUsername("")}
                        className="hover:text-blue-300"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {filterAction && filterAction !== "all" && (
                    <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs font-medium flex items-center gap-1">
                      Action: {filterAction}
                      <button
                        onClick={() => setFilterAction("all")}
                        className="hover:text-green-300"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400">No audit logs found</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-800/50">
                        {/* <TableHead className="text-slate-300">ID</TableHead> */}
                        <TableHead className="text-slate-300">Request ID</TableHead>
                        <TableHead className="text-slate-300">
                          <button
                            onClick={() => handleSort("username")}
                            className="flex items-center hover:text-white transition-colors"
                          >
                            User Name
                            <SortIcon field="username" />
                          </button>
                        </TableHead>
                        <TableHead className="text-slate-300">Action</TableHead>
                        <TableHead className="text-slate-300">Region</TableHead>
                        <TableHead className="text-slate-300">
                          <button
                            onClick={() => handleSort("createdAt")}
                            className="flex items-center hover:text-white transition-colors"
                          >
                            Timestamp
                            <SortIcon field="createdAt" />
                          </button>
                        </TableHead>
                        <TableHead className="text-slate-300">Payload</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow
                          key={log.id}
                          className="border-slate-800 hover:bg-slate-800/30"
                        >
                          {/* <TableCell className="text-slate-300 font-mono text-sm">
                            {log.id}
                          </TableCell> */}
                          <TableCell className="text-slate-300">
                            {log.requestId}
                          </TableCell>
                          <TableCell className="text-slate-300">
                            {log.username || log.doneBy}
                          </TableCell>
                          <TableCell className="text-slate-300">
                            <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-medium">
                              {log.action}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-300">
                            <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-xs font-medium">
                              {log.region}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-300 text-sm">
                            {formatDate(log.createdAt)}
                          </TableCell>
                          <TableCell className="text-slate-400 text-xs max-w-md">
                            <pre className="whitespace-pre-wrap break-words font-mono">
                              {formatPayload(log.payload)}
                            </pre>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-slate-400">
                    Page {pagination.page} of {pagination.totalPages} (
                    {pagination.total} total entries)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1 || isLoading}
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages || isLoading}
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </RouteProtection>
  );
}

