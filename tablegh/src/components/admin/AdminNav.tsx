"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  UtensilsCrossed,
  BarChart3,
  Settings,
  ChevronDown,
  Menu,
  X,
  Building2,
  MapPin,
  QrCode,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface AdminNavProps {
  restaurants: Restaurant[];
  userName: string;
  isGlobalAdmin: boolean;
}

const NAV_ITEMS = [
  { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "reservations", label: "Reservations", icon: CalendarDays },
  { href: "floor-plan", label: "Floor Plan", icon: MapPin },
  { href: "menu", label: "Menu", icon: UtensilsCrossed },
  { href: "analytics", label: "Analytics", icon: BarChart3 },
  { href: "walkin", label: "Walk-In Queue", icon: QrCode },
  { href: "settings", label: "Settings", icon: Settings },
];

export function AdminNav({ restaurants, userName, isGlobalAdmin }: AdminNavProps) {
  const params = useParams();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [restaurantPickerOpen, setRestaurantPickerOpen] = useState(false);

  const currentRestaurantId = params["restaurantId"] as string | undefined;
  const currentRestaurant = restaurants.find((r) => r.id === currentRestaurantId);

  function isActive(href: string) {
    return pathname.includes(`/${href}`);
  }

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#E8E5E0]">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="text-xl font-bold"
            style={{ color: "#0F7B5A", fontFamily: "Fraunces, serif" }}
          >
            TableGH
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-[#0F7B5A]/10 text-[#0F7B5A] font-medium">
            Admin
          </span>
        </Link>
      </div>

      {/* Restaurant picker */}
      {restaurants.length > 0 && (
        <div className="px-3 py-3 border-b border-[#E8E5E0]">
          <button
            onClick={() => setRestaurantPickerOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-[#E8E5E0] transition-colors text-left"
          >
            <Building2 size={16} className="text-[#8B8680] flex-shrink-0" />
            <span className="text-sm font-medium text-[#1A1A1A] flex-1 truncate">
              {currentRestaurant?.name ?? "Select restaurant"}
            </span>
            <ChevronDown
              size={14}
              className={`text-[#8B8680] transition-transform ${
                restaurantPickerOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {restaurantPickerOpen && (
            <div className="mt-1 bg-white rounded-xl border border-[#E8E5E0] shadow-lg overflow-hidden">
              {restaurants.map((r) => (
                <Link
                  key={r.id}
                  href={`/admin/${r.id}/dashboard`}
                  onClick={() => setRestaurantPickerOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-[#FAF7F2] transition-colors ${
                    r.id === currentRestaurantId
                      ? "text-[#0F7B5A] font-medium"
                      : "text-[#1A1A1A]"
                  }`}
                >
                  <span className="truncate">{r.name}</span>
                  {r.id === currentRestaurantId && (
                    <span className="ml-auto text-xs text-[#0F7B5A]">✓</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Admin navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const to = currentRestaurantId
            ? `/admin/${currentRestaurantId}/${href}`
            : "#";
          const active = isActive(href);

          return (
            <Link
              key={href}
              href={to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-[#0F7B5A] text-white"
                  : "text-[#5E5A57] hover:bg-[#E8E5E0] hover:text-[#1A1A1A]"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-4 py-4 border-t border-[#E8E5E0] flex items-center gap-3">
        <UserButton afterSignOutUrl="/" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#1A1A1A] truncate">{userName}</p>
          {isGlobalAdmin && (
            <p className="text-xs text-[#0F7B5A]">Global Admin</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col bg-white border-r border-[#E8E5E0] min-h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#E8E5E0] flex items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="text-lg font-bold"
          style={{ color: "#0F7B5A", fontFamily: "Fraunces, serif" }}
        >
          TableGH Admin
        </Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="p-2 rounded-lg hover:bg-[#F5F2ED]"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl flex flex-col">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
