"use client";

import { Phone, Menu, Users, CheckCircle, Pause, Play, ParkingCircle, ArrowRightLeft, Voicemail, X, Radio, Volume2 } from "lucide-react";
import type { CallFlowEvent } from "@/types/ops-api";
import { cn } from "@/lib/utils";

interface CallFlowTimelineProps {
  events: CallFlowEvent[];
  callStartTime: string;
}

const getEventIcon = (action: string) => {
  const actionUpper = action.toUpperCase();
  
  if (actionUpper.includes("INCOMING_CALL") || actionUpper.includes("OUTGOING_CALL")) {
    return { icon: Phone, color: actionUpper.includes("INCOMING") ? "text-green-400" : "text-blue-400", bg: actionUpper.includes("INCOMING") ? "bg-green-500/20" : "bg-blue-500/20" };
  }
  if (actionUpper.includes("IVR")) {
    return { icon: Menu, color: "text-purple-400", bg: "bg-purple-500/20" };
  }
  if (actionUpper.includes("QUEUE") || actionUpper.includes("ENTERED_QUEUE")) {
    return { icon: Users, color: "text-orange-400", bg: "bg-orange-500/20" };
  }
  if (actionUpper.includes("ANSWERED")) {
    return { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/20" };
  }
  if (actionUpper.includes("CALL_ON_HOLD")) {
    return { icon: Pause, color: "text-yellow-400", bg: "bg-yellow-500/20" };
  }
  if (actionUpper.includes("CALL_RETRIEVED")) {
    return { icon: Play, color: "text-blue-400", bg: "bg-blue-500/20" };
  }
  if (actionUpper.includes("CALL_ON_PARK")) {
    return { icon: ParkingCircle, color: "text-amber-400", bg: "bg-amber-500/20" };
  }
  if (actionUpper.includes("TRANSFER")) {
    return { icon: ArrowRightLeft, color: "text-blue-400", bg: "bg-blue-500/20" };
  }
  if (actionUpper.includes("VOICEMAIL")) {
    return { icon: Voicemail, color: "text-red-400", bg: "bg-red-500/20" };
  }
  if (actionUpper.includes("DISCONNECTED")) {
    return { icon: X, color: "text-red-400", bg: "bg-red-500/20" };
  }
  if (actionUpper.includes("RECORDING")) {
    return { icon: Radio, color: "text-indigo-400", bg: "bg-indigo-500/20" };
  }
  if (actionUpper.includes("PLAYBACK")) {
    return { icon: Volume2, color: "text-cyan-400", bg: "bg-cyan-500/20" };
  }
  
  return { icon: Phone, color: "text-slate-400", bg: "bg-slate-500/20" };
};

const formatRelativeTime = (timestamp: string, startTime: string) => {
  const eventTime = new Date(timestamp).getTime();
  const start = new Date(startTime).getTime();
  const diffSeconds = Math.floor((eventTime - start) / 1000);
  
  if (diffSeconds < 0) return "0s";
  if (diffSeconds < 60) return `${diffSeconds}s`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ${diffSeconds % 60}s`;
  return `${Math.floor(diffSeconds / 3600)}h ${Math.floor((diffSeconds % 3600) / 60)}m`;
};

const formatEventDetails = (event: CallFlowEvent): string[] => {
  const details: string[] = [];
  const args = event.arguments || {};
  
  switch (event.action.toUpperCase()) {
    case "INCOMING_CALL":
    case "OUTGOING_CALL":
      if (args.phone_number) details.push(`Phone: ${args.phone_number}`);
      if (args.phone_tree_name) details.push(`Tree: ${args.phone_tree_name}`);
      if (args.extension_number) details.push(`Ext: ${args.extension_number}`);
      if (args.from_time && args.to_time) details.push(`Time: ${args.from_time} - ${args.to_time}`);
      if (event.isCampaign) details.push("📢 Campaign Call");
      break;
      
    case "IVR":
      if (args.selected_key) details.push(`Selected: ${args.selected_key}`);
      if (args.phone_tree_name) details.push(`Tree: ${args.phone_tree_name}`);
      if (args.extension_number) details.push(`Ext: ${args.extension_number}`);
      break;
      
    case "QUEUE":
    case "ENTERED_QUEUE":
      if (args.queue_name) details.push(`Queue: ${args.queue_name}`);
      if (args.extension_number) details.push(`Ext: ${args.extension_number}`);
      if (args.behavior) details.push(`Behavior: ${args.behavior}`);
      if (args.ring_groups) {
        try {
          const groups = JSON.parse(args.ring_groups);
          if (Array.isArray(groups) && groups.length > 0) {
            details.push(`Agents: ${groups.length} attempted`);
          }
        } catch {
          if (args.ring_groups) details.push(`Groups: ${args.ring_groups}`);
        }
      }
      break;
      
    case "ANSWERED":
      if (args.answered_by) details.push(`By: ${args.answered_by}`);
      if (args.extension_number) details.push(`Ext: ${args.extension_number}`);
      if (args.call_duration) details.push(`Duration: ${args.call_duration}`);
      break;
      
    case "BLIND_TRANSFER":
    case "WARM_TRANSFER":
      if (args.from_name) details.push(`From: ${args.from_name}`);
      if (args.from_extension) details.push(`From Ext: ${args.from_extension}`);
      if (args.to_name) details.push(`To: ${args.to_name}`);
      if (args.to_extension) details.push(`To Ext: ${args.to_extension}`);
      if (args.status) details.push(`Status: ${args.status}`);
      if (args.call_duration) details.push(`Duration: ${args.call_duration}`);
      break;
      
    case "VOICEMAIL":
      if (args.sent_to) details.push(`To: ${args.sent_to}`);
      if (args.extension_number) details.push(`Ext: ${args.extension_number}`);
      break;
      
    default:
      // Show all arguments for unknown event types
      Object.entries(args).forEach(([key, value]) => {
        if (value) {
          try {
            const parsed = JSON.parse(value);
            details.push(`${key}: ${JSON.stringify(parsed)}`);
          } catch {
            details.push(`${key}: ${value}`);
          }
        }
      });
  }
  
  return details;
};

export function CallFlowTimeline({ events, callStartTime }: CallFlowTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>No call flow events available</p>
      </div>
    );
  }

  return (
    <div className="relative pl-2">
      <div className="space-y-4">
        {events.map((event, index) => {
          const { icon: Icon, color, bg } = getEventIcon(event.action);
          const isLast = index === events.length - 1;
          const relativeTime = formatRelativeTime(event.timestamp, callStartTime);
          const details = formatEventDetails(event);
          
          return (
            <div key={index} className="relative flex items-start gap-4">
              {/* Timeline connector line */}
              {!isLast && (
                <div className="absolute left-6 top-12 w-0.5 h-full bg-slate-700" style={{ height: 'calc(100% + 1rem)' }} />
              )}
              
              {/* Icon circle */}
              <div className={cn(
                "relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-700",
                bg
              )}>
                <Icon className={cn("h-5 w-5", color)} />
              </div>
              
              {/* Content card */}
              <div className="flex-1">
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-white capitalize">
                        {event.action.replace(/_/g, " ").toLowerCase()}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-400 bg-slate-700 px-2 py-1 rounded">
                      +{relativeTime}
                    </span>
                  </div>
                  
                  {details.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {details.map((detail, detailIndex) => (
                        <p key={detailIndex} className="text-sm text-slate-300">
                          {detail}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

