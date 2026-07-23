"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BRAND } from "@/lib/brand-config";
import { TikTokIcon } from "./tiktok-icon";

export function SiteFooter() {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);

  return (
    <footer
      className="relative mt-auto overflow-hidden border-t border-emerald/15 bg-night-soft/60 backdrop-blur-md"
      dir="rtl"
      lang="ar"
    >
      {/* Decorative neon top border */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(42, 125, 91, 0.30), rgba(74, 157, 161, 0.5), transparent)",
        }}
      />
      {/* Decorative orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(74, 157, 161, 0.30) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-5 px-6 py-12 text-center font-arabic">
        <div className="flex items-center gap-3">
          <div className="neon-ring h-14 w-14 rounded-full p-[2px]">
            <div className="h-full w-full overflow-hidden rounded-full bg-night">
              <Image
                src={BRAND.logoPath}
                alt={BRAND.name}
                width={56}
                height={56}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="text-right">
            <p className="font-arabic text-2xl font-bold">
              <span className="text-blue-black-animated">{BRAND.name}</span>
            </p>
            <p className="text-xs text-gray">{BRAND.nameLatin}</p>
          </div>
        </div>

        <a
          href={BRAND.contact.tiktokUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 font-arabic text-sm text-gray transition-colors hover:text-emerald"
        >
          <TikTokIcon className="h-4 w-4 text-emerald" />
          @{BRAND.contact.tiktok}
        </a>

        <p className="font-arabic text-xs text-gray-light">
          💵 الدفع عند الاستلام · توصيل لكل الولايات
        </p>

        <p className="font-arabic text-xs text-gray-light">
          © {year ?? ""} {BRAND.name}. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  );
}
