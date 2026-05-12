"use client";

import { UserMenu } from "./user-menu";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-end border-b border-slate-800 bg-slate-900 px-6">
      <UserMenu />
    </header>
  );
}
