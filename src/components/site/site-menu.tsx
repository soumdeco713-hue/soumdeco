"use client";

import Image from "next/image";
import { Menu, X, Instagram, Facebook, Phone, Mail } from "lucide-react";
import { BRAND } from "@/lib/brand-config";

type SiteMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const LINKS = [
  { href: "#accueil", label: "الرئيسية" },
  { href: "#vedettes", label: "منتجات مميّزة" },
  { href: "#categories", label: "الفئات" },
  { href: "#tous", label: "كل المنتجات" },
  { href: "#apropos", label: "من نحن" },
];

export function SiteMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="فتح القائمة"
      className="flex items-center gap-1.5 rounded-full border border-emerald/30 bg-night-soft/70 px-4 py-2.5 font-arabic text-base font-medium text-charcoal shadow-lg backdrop-blur-md transition-colors hover:border-emerald hover:bg-emerald/10 focus:outline-none focus:ring-2 focus:ring-emerald/50 active:scale-95"
      dir="rtl"
    >
      <Menu className="h-5 w-5 text-emerald" />
      <span>القائمة</span>
    </button>
  );
}

export function SiteMenu({ open, onOpenChange }: SiteMenuProps) {
  const handleNav = (href: string) => {
    onOpenChange(false);
    setTimeout(() => {
      const el = document.querySelector(href);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" dir="rtl">
      {/* Overlay — fade in via CSS animation */}
      <div
        onClick={() => onOpenChange(false)}
        className="drawer-overlay absolute inset-0 bg-night/70 backdrop-blur-sm"
      />
      {/* Drawer panel — slide in from the right via CSS animation */}
      <div
        className="drawer-panel-right drawer-slide absolute right-0 top-0 flex h-full w-[300px] max-w-[88vw] flex-col border-l border-emerald/20 bg-night-soft/95 shadow-2xl backdrop-blur-xl"
        role="dialog"
        aria-label="القائمة"
      >
        <div className="flex items-center justify-between border-b border-clay/30 px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="neon-ring h-10 w-10 rounded-full p-[2px]">
              <div className="h-full w-full overflow-hidden rounded-full bg-night">
                <Image
                  src={BRAND.logoPath}
                  alt={BRAND.name}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <span className="font-arabic text-xl font-bold">
              <span className="text-blue-black-animated">{BRAND.name}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="إغلاق"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray transition-colors hover:bg-night hover:text-emerald"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col p-2 font-arabic">
          {LINKS.map((l) => (
            <button
              key={l.href}
              type="button"
              onClick={() => handleNav(l.href)}
              className="rounded-xl px-4 py-3.5 text-right text-base font-medium text-charcoal transition-colors hover:bg-emerald/10 hover:text-emerald"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3 border-t border-clay/30 p-4">
          <a
            href={BRAND.contact.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 font-arabic text-sm text-charcoal transition-colors hover:text-brass"
          >
            <Instagram className="h-5 w-5 text-brass" />
            @{BRAND.contact.instagram}
          </a>
          <a
            href={BRAND.contact.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 font-arabic text-sm text-charcoal transition-colors hover:text-brass"
          >
            <Facebook className="h-5 w-5 text-brass" />
            Facebook
          </a>
          <a
            href={`tel:${BRAND.contact.phone}`}
            className="flex items-center justify-center gap-2 font-arabic text-sm text-charcoal transition-colors hover:text-brass"
            dir="ltr"
          >
            <Phone className="h-5 w-5 text-brass" />
            {BRAND.contact.phoneDisplay}
          </a>
          <a
            href={`mailto:${BRAND.contact.email}`}
            className="flex items-center justify-center gap-2 font-arabic text-sm text-charcoal transition-colors hover:text-brass break-all"
            dir="ltr"
          >
            <Mail className="h-5 w-5 text-brass flex-shrink-0" />
            <span className="text-xs">{BRAND.contact.email}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
