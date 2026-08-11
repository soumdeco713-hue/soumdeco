"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Instagram, Facebook, Phone, Mail, MapPin } from "lucide-react";
import { BRAND } from "@/lib/brand-config";

export function SiteFooter() {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);

  return (
    <footer
      className="relative mt-auto overflow-hidden border-t border-emerald/15 bg-night-soft/60 backdrop-blur-sm"
     
     
    >
      {/* Decorative neon top border */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(154, 126, 58, 0.30), rgba(184, 150, 86, 0.5), transparent)",
        }}
      />
      {/* Decorative orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(154, 126, 58, 0.25) 0%, transparent 70%)",
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
          <div className="text-left">
            <p className="font-arabic text-2xl font-bold">
              <span className="text-blue-black-animated">{BRAND.name}</span>
            </p>
            <p className="text-xs text-gray">{BRAND.nameLatin}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <a
            href={BRAND.contact.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="flex items-center gap-2 font-arabic text-sm text-gray transition-colors hover:text-brass"
          >
            <Instagram className="h-4 w-4" />
            @{BRAND.contact.instagram}
          </a>
          <span className="text-clay">·</span>
          <a
            href={BRAND.contact.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="flex items-center gap-2 font-arabic text-sm text-gray transition-colors hover:text-brass"
          >
            <Facebook className="h-4 w-4" />
            Facebook
          </a>
          <span className="text-clay">·</span>
          <a
            href={`tel:${BRAND.contact.phone}`}
            aria-label="Téléphone"
            className="flex items-center gap-2 font-arabic text-sm text-gray transition-colors hover:text-brass"
            dir="ltr"
          >
            <Phone className="h-4 w-4" />
            {BRAND.contact.phoneDisplay}
          </a>
          <span className="text-clay">·</span>
          <a
            href={`mailto:${BRAND.contact.email}`}
            aria-label="Email"
            className="flex items-center gap-2 font-arabic text-sm text-gray transition-colors hover:text-brass"
            dir="ltr"
          >
            <Mail className="h-4 w-4" />
            {BRAND.contact.email}
          </a>
        </div>

        <p className="flex items-center justify-center gap-1.5 font-arabic text-xs text-gray-light">
          <MapPin className="h-3.5 w-3.5" />
          {BRAND.contact.address}
        </p>

        <p className="font-arabic text-xs text-gray-light">
          💵 Paiement à la livraison · الدفع عند الاستلام
        </p>

        <p className="font-arabic text-xs text-gray-light" suppressHydrationWarning>
          © {year ?? ""} {BRAND.name}. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  );
}
