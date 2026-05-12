"use client";

import { createContext, useContext } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { OPS_REGION_CODE } from "@/lib/regions";

const RegionContext = createContext<{ region: string }>({
  region: OPS_REGION_CODE,
});

export function useRegion() {
  return useContext(RegionContext);
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl">
            <RegionContext.Provider value={{ region: OPS_REGION_CODE }}>
              {children}
            </RegionContext.Provider>
          </div>
        </main>
      </div>
    </div>
  );
}
