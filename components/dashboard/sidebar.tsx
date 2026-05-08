"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { hasRoutePermission } from "@/lib/route-permissions";
import {
  LayoutDashboard,
  RefreshCw,
  MessageSquare,
  Link2,
  Phone,
  Database,
  Settings,
  Search,
  FileText,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

import Image from "next/image";
import voicestackLogo from "@/public/voicestack.png";

const navigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    color: "text-cyan-400",
    activeBg: "bg-gradient-to-r from-cyan-500 to-blue-500",
  },
];

const provisionItems = [
  {
    name: "Check Sync",
    href: "/provision/check-sync",
    icon: RefreshCw,
    color: "text-violet-400",
    activeBg: "bg-gradient-to-r from-violet-500 to-purple-600",
    permission: "check-sync",
  },
];

const commonUtilitiesItems = [
  {
    name: "RabbitMQ",
    href: "/common-utilities/rabbitmq",
    icon: MessageSquare,
    color: "text-emerald-400",
    activeBg: "bg-gradient-to-r from-emerald-500 to-teal-600",
    permission: "rabbitmq",
  },
  {
    name: "Generate Signed URL",
    href: "/common-utilities/generate-signed-url",
    icon: Link2,
    color: "text-sky-400",
    activeBg: "bg-gradient-to-r from-sky-500 to-cyan-600",
    permission: "generate-signed-url",
  },
  {
    name: "Call Details",
    href: "/call-details",
    icon: Search,
    color: "text-indigo-400",
    activeBg: "bg-gradient-to-r from-indigo-500 to-purple-600",
    permission: "call-details",
  },
];

const numbersItems = [
  {
    name: "Numbers Lookup",
    href: "/numbers",
    icon: Phone,
    color: "text-amber-400",
    activeBg: "bg-gradient-to-r from-amber-500 to-orange-600",
    permission: "numbers-not-in-bifrost",
  },
  {
    name: "Numbers Not in Cache",
    href: "/numbers-not-in-number-cache",
    icon: Database,
    color: "text-rose-400",
    activeBg: "bg-gradient-to-r from-rose-500 to-pink-600",
    permission: "numbers-not-in-cache",
  },
];

const twilioItems = [
  {
    name: "Twilio Operations",
    href: "/twilio",
    icon: Settings,
    color: "text-yellow-400",
    activeBg: "bg-gradient-to-r from-yellow-500 to-amber-600",
  },
];

const simwoodItems = [
  {
    name: "Dashboard",
    href: "/simwood",
    icon: Phone,
    color: "text-blue-400",
    activeBg: "bg-gradient-to-r from-blue-500 to-cyan-600",
    permission: "simwood",
  },
  {
    name: "Port In",
    href: "/simwood/port-in",
    icon: FileText,
    color: "text-blue-400",
    activeBg: "bg-gradient-to-r from-blue-500 to-cyan-600",
    permission: "simwood",
  },
];

const adminItems = [
  {
    name: "Audit Logs",
    href: "/audit-logs",
    icon: FileText,
    color: "text-red-400",
    activeBg: "bg-gradient-to-r from-red-500 to-rose-600",
    permission: "super_admin",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    provision: true,
    commonUtilities: true,
    numbers: true,
    twilio: true,
    simwood: true,
    admin: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const isActive = (href: string) => pathname === href;

  // Get user permissions from session
  const sessionUser = session?.user as { permissions?: string[]; role?: string | null } | undefined;
  const permissions = sessionUser?.permissions ?? [];
  const role = sessionUser?.role ?? null;

  // Check if user has permission for a route
  const hasPermission = (route: string) => {
    return hasRoutePermission(permissions, role, route);
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-800 bg-slate-900">
      <div className="flex h-16 items-center border-b border-slate-800 px-6">
        <h1 className="text-xl font-bold text-white">Control Plane</h1>
        <Image src={voicestackLogo} alt="Voicestack" width={24} height={24} className="ml-2" />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                active
                  ? `${item.activeBg} text-white shadow-lg shadow-cyan-500/20`
                  : "text-slate-400 hover:bg-slate-800 hover:text-white hover:scale-[1.02]"
              )}
            >
              <item.icon className={cn("h-5 w-5", active ? "text-white" : item.color)} />
              {item.name}
            </Link>
          );
        })}

        {/* Provision Section */}
        {provisionItems.some((item) => hasPermission(item.href)) && (
          <Collapsible
            open={openSections.provision}
            onOpenChange={() => toggleSection("provision")}
          >
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-violet-300 hover:bg-slate-800 transition-all duration-200 hover:scale-[1.02]">
            <span className="flex items-center gap-2">
              <span className="w-1 h-4 bg-gradient-to-b from-violet-400 to-purple-600 rounded-full"></span>
              Provision
            </span>
            {openSections.provision ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            {provisionItems.map((item) => {
              const active = isActive(item.href);
              const hasAccess = hasPermission(item.href);
              
              if (!hasAccess) return null;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 pl-6 text-sm font-medium transition-all duration-200",
                    active
                      ? `${item.activeBg} text-white shadow-lg shadow-violet-500/20`
                      : "text-slate-400 hover:bg-slate-800 hover:text-white hover:scale-[1.02]"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", active ? "text-white" : item.color)} />
                  {item.name}
                </Link>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
        )}

        {/* Common Utilities Section */}
        {commonUtilitiesItems.some((item) => hasPermission(item.href)) && (
          <Collapsible
            open={openSections.commonUtilities}
            onOpenChange={() => toggleSection("commonUtilities")}
          >
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-slate-800 transition-all duration-200 hover:scale-[1.02]">
            <span className="flex items-center gap-2">
              <span className="w-1 h-4 bg-gradient-to-b from-emerald-400 to-teal-600 rounded-full"></span>
              Common Utilities
            </span>
            {openSections.commonUtilities ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            {commonUtilitiesItems.map((item) => {
              const active = isActive(item.href);
              const hasAccess = hasPermission(item.href);
              
              if (!hasAccess) return null;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 pl-6 text-sm font-medium transition-all duration-200",
                    active
                      ? `${item.activeBg} text-white shadow-lg shadow-emerald-500/20`
                      : "text-slate-400 hover:bg-slate-800 hover:text-white hover:scale-[1.02]"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", active ? "text-white" : item.color)} />
                  {item.name}
                </Link>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
        )}

        {/* Numbers Section */}
        {numbersItems.some((item) => hasPermission(item.href)) && (
          <Collapsible
            open={openSections.numbers}
            onOpenChange={() => toggleSection("numbers")}
          >
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-amber-300 hover:bg-slate-800 transition-all duration-200 hover:scale-[1.02]">
            <span className="flex items-center gap-2">
              <span className="w-1 h-4 bg-gradient-to-b from-amber-400 to-orange-600 rounded-full"></span>
              Numbers
            </span>
            {openSections.numbers ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            {numbersItems.map((item) => {
              const active = isActive(item.href);
              const hasAccess = hasPermission(item.href);
              
              if (!hasAccess) return null;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 pl-6 text-sm font-medium transition-all duration-200",
                    active
                      ? `${item.activeBg} text-white shadow-lg shadow-amber-500/20`
                      : "text-slate-400 hover:bg-slate-800 hover:text-white hover:scale-[1.02]"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", active ? "text-white" : item.color)} />
                  {item.name}
                </Link>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
        )}

        {/* Twilio Section */}
        {twilioItems.some((item) => hasPermission(item.href)) && (
          <Collapsible
            open={openSections.twilio}
            onOpenChange={() => toggleSection("twilio")}
          >
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-yellow-300 hover:bg-slate-800 transition-all duration-200 hover:scale-[1.02]">
            <span className="flex items-center gap-2">
              <span className="w-1 h-4 bg-gradient-to-b from-yellow-400 to-amber-600 rounded-full"></span>
              Twilio
            </span>
            {openSections.twilio ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            {twilioItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 pl-6 text-sm font-medium transition-all duration-200",
                    active
                      ? `${item.activeBg} text-white shadow-lg shadow-yellow-500/20`
                      : "text-slate-400 hover:bg-slate-800 hover:text-white hover:scale-[1.02]"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", active ? "text-white" : item.color)} />
                  {item.name}
                </Link>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
        )}

        {/* Simwood Section */}
        {simwoodItems.some((item) => hasPermission(item.href)) && (
          <Collapsible
            open={openSections.simwood}
            onOpenChange={() => toggleSection("simwood")}
          >
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-blue-300 hover:bg-slate-800 transition-all duration-200 hover:scale-[1.02]">
            <span className="flex items-center gap-2">
              <span className="w-1 h-4 bg-gradient-to-b from-blue-400 to-cyan-600 rounded-full"></span>
              Simwood
            </span>
            {openSections.simwood ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            {simwoodItems.map((item) => {
              const active = isActive(item.href);
              const hasAccess = hasPermission(item.href);
              
              if (!hasAccess) return null;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 pl-6 text-sm font-medium transition-all duration-200",
                    active
                      ? `${item.activeBg} text-white shadow-lg shadow-blue-500/20`
                      : "text-slate-400 hover:bg-slate-800 hover:text-white hover:scale-[1.02]"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", active ? "text-white" : item.color)} />
                  {item.name}
                </Link>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
        )}

        {/* Admin Section */}
        {adminItems.some((item) => hasPermission(item.href)) && (
          <Collapsible
            open={openSections.admin}
            onOpenChange={() => toggleSection("admin")}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-red-300 hover:bg-slate-800 transition-all duration-200 hover:scale-[1.02]">
              <span className="flex items-center gap-2">
                <span className="w-1 h-4 bg-gradient-to-b from-red-400 to-rose-600 rounded-full"></span>
                Admin
              </span>
              {openSections.admin ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1">
              {adminItems.map((item) => {
                const active = isActive(item.href);
                const hasAccess = hasPermission(item.href);
                
                if (!hasAccess) return null;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 pl-6 text-sm font-medium transition-all duration-200",
                      active
                        ? `${item.activeBg} text-white shadow-lg shadow-red-500/20`
                        : "text-slate-400 hover:bg-slate-800 hover:text-white hover:scale-[1.02]"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", active ? "text-white" : item.color)} />
                    {item.name}
                  </Link>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}
      </nav>
    </div>
  );
}
