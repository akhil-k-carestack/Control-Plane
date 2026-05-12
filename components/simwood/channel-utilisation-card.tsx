"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ChannelInterval = "1m" | "5m" | "10m" | "1h";
type ChannelTraffic = "both" | "inbound" | "outbound";

const INTERVALS: ChannelInterval[] = ["1m", "5m", "10m", "1h"];
const TRAFFIC_OPTIONS: { value: ChannelTraffic; label: string }[] = [
  { value: "both", label: "In+Out" },
  { value: "outbound", label: "Outbound" },
  { value: "inbound", label: "Inbound" },
];

const INBOUND_FILL = "#38bdf8";
const OUTBOUND_FILL = "#818cf8";
const CHART_GRID = "#334155";
const CHART_AXIS = "#94a3b8";
const TOOLTIP_BG = "#0f172a";
const TOOLTIP_BORDER = "#475569";
const TOOLTIP_TEXT = "#e2e8f0";

function segmentToggleClass(active: boolean): string {
  return active
    ? "border-slate-600 bg-slate-800 text-white shadow-sm hover:bg-slate-800 hover:text-white"
    : "border-transparent bg-transparent text-slate-400 hover:bg-slate-800/70 hover:text-slate-200";
}

export function ChannelUtilisationCard() {
  const [interval, setInterval] = useState<ChannelInterval>("10m");
  const [traffic, setTraffic] = useState<ChannelTraffic>("both");
  const [chartRows, setChartRows] = useState<
    { idx: number; t: string; inbound: number; outbound: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ interval, traffic });
      const res = await fetch(`/api/simwood/channel-utilisation?${qs}`);
      const body = (await res.json()) as { error?: string; data?: { t: string; inbound: number; outbound: number }[] };
      if (!res.ok) {
        throw new Error(body.error || "Failed to load channel utilisation");
      }
      const rows = Array.isArray(body.data) ? body.data : [];
      setChartRows(
        rows.map((r, idx) => ({
          idx,
          t: r.t || String(idx),
          inbound: typeof r.inbound === "number" ? r.inbound : 0,
          outbound: typeof r.outbound === "number" ? r.outbound : 0,
        }))
      );
    } catch (e) {
      setChartRows([]);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [interval, traffic]);

  useEffect(() => {
    void load();
  }, [load]);

  const yMax = useMemo(() => {
    let m = 0;
    for (const r of chartRows) {
      m = Math.max(m, r.inbound + r.outbound, r.inbound, r.outbound);
    }
    const padded = Math.ceil(m * 1.08);
    return Math.max(120, padded === 0 ? 120 : Math.ceil(padded / 12) * 12);
  }, [chartRows]);

  const yTicks = useMemo(() => {
    const step = yMax <= 120 ? 24 : Math.max(24, Math.ceil(yMax / 6));
    const ticks: number[] = [];
    for (let t = 0; t <= yMax; t += step) ticks.push(t);
    if (ticks[ticks.length - 1] < yMax) ticks.push(yMax);
    return ticks;
  }, [yMax]);

  const xTickFormatter = (idx: number) => {
    if (chartRows.length <= 12) return String(idx);
    const step = Math.ceil(chartRows.length / 8);
    return idx % step === 0 ? String(idx) : "";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Activity className="h-5 w-5 shrink-0 text-sky-400" aria-hidden />
              Channel utilisation (past 24h)
            </CardTitle>
            <CardDescription>
              Peak concurrent channels from SIMWOOD, sampled by interval. Toggle traffic direction and bucket size
              below.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-md border border-slate-800 bg-slate-950/40 p-0.5">
              {TRAFFIC_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn("h-8 border px-2.5 text-xs font-medium", segmentToggleClass(traffic === opt.value))}
                  onClick={() => setTraffic(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 rounded-md border border-slate-800 bg-slate-950/40 p-0.5">
              {INTERVALS.map((iv) => (
                <Button
                  key={iv}
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-8 min-w-[2.25rem] border px-2 text-xs font-medium",
                    segmentToggleClass(interval === iv)
                  )}
                  onClick={() => setInterval(iv)}
                >
                  {iv}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-slate-500" aria-hidden />
            Loading channel data…
          </div>
        ) : error ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : chartRows.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
            No samples returned for this interval.
          </div>
        ) : (
          <div className="h-[300px] w-full min-w-0 text-slate-300">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                margin={{ top: 8, right: 8, left: 4, bottom: 8 }}
                barCategoryGap="2%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis
                  dataKey="idx"
                  tickFormatter={xTickFormatter}
                  tick={{ fontSize: 10, fill: CHART_AXIS }}
                  stroke={CHART_GRID}
                />
                <YAxis
                  domain={[0, yMax]}
                  ticks={yTicks}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: CHART_AXIS }}
                  stroke={CHART_GRID}
                />
                <ReferenceArea
                  y1={48}
                  y2={Math.min(120, yMax)}
                  fill={INBOUND_FILL}
                  fillOpacity={0.06}
                  strokeOpacity={0}
                />
                {yMax >= 60 && (
                  <ReferenceLine
                    y={60}
                    stroke={INBOUND_FILL}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    label={{ value: "60", position: "right", fill: INBOUND_FILL, fontSize: 11 }}
                  />
                )}
                {yMax >= 120 && (
                  <ReferenceLine
                    y={120}
                    stroke="#f87171"
                    strokeWidth={2}
                    label={{ value: "120", position: "right", fill: "#f87171", fontSize: 11 }}
                  />
                )}
                <Tooltip
                  contentStyle={{
                    backgroundColor: TOOLTIP_BG,
                    border: `1px solid ${TOOLTIP_BORDER}`,
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: TOOLTIP_TEXT,
                  }}
                  formatter={(value: number, name: string) => [
                    value,
                    name === "Inbound traffic" ? "Inbound" : name === "Outbound traffic" ? "Outbound" : name,
                  ]}
                  labelFormatter={(_label, payload) => {
                    const row = payload?.[0]?.payload as { t?: string; idx?: number } | undefined;
                    return row?.t ? String(row.t) : `Sample ${row?.idx ?? ""}`;
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", color: CHART_AXIS }}
                  formatter={(value) => <span className="text-slate-400">{value}</span>}
                />
                {(traffic === "both" || traffic === "inbound") && (
                  <Bar
                    dataKey="inbound"
                    stackId="ch"
                    fill={INBOUND_FILL}
                    name="Inbound traffic"
                    isAnimationActive={false}
                  />
                )}
                {(traffic === "both" || traffic === "outbound") && (
                  <Bar
                    dataKey="outbound"
                    stackId="ch"
                    fill={OUTBOUND_FILL}
                    name="Outbound traffic"
                    isAnimationActive={false}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
