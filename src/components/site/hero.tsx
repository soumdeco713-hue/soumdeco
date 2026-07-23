"use client";

import Image from "next/image";
import { Sparkles } from "lucide-react";
import { BRAND } from "@/lib/brand-config";

export function Hero() {
  return (
    <section
      id="accueil"
      className="relative flex flex-col items-center justify-center overflow-hidden px-6 pt-14 pb-4 sm:pt-16 sm:pb-6"
      dir="rtl"
      lang="ar"
    >
      {/* Animated neon orbs in the background — pure CSS animations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="float-strong absolute -top-10 right-10 h-64 w-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(42, 125, 91, 0.18) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          className="float-strong absolute top-20 -left-10 h-72 w-72 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(184, 144, 47, 0.15) 0%, transparent 70%)",
            filter: "blur(50px)",
            animationDelay: "1s",
          }}
        />
        <div
          className="float-strong absolute bottom-0 right-1/3 h-56 w-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(194, 91, 126, 0.12) 0%, transparent 70%)",
            filter: "blur(40px)",
            animationDelay: "2s",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Animated logo with neon ring */}
        <div className="fade-up relative mb-3 h-16 w-16 sm:h-20 sm:w-20">
          {/* Outer pulsing glow */}
          <div
            aria-hidden
            className="pulse-soft absolute -inset-4 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(42, 125, 91, 0.22) 0%, transparent 70%)",
              filter: "blur(12px)",
            }}
          />
          {/* Neon ring (static) */}
          <div className="neon-ring absolute inset-0 rounded-full p-[3px]">
            <div className="h-full w-full overflow-hidden rounded-full bg-night">
              <Image
                src={BRAND.logoPath}
                alt={`${BRAND.name} logo`}
                width={112}
                height={112}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </div>
        </div>

        {/* Brand name — animated reveal with neon gradient */}
        <h1 className="fade-up font-arabic text-4xl font-bold tracking-tight sm:text-6xl">
          <span className="text-blue-black-animated">{BRAND.name}</span>
        </h1>

        {/* Decorative neon line */}
        <div
          className="fade-up mt-3 h-[2px] w-20 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, #0F1622, #1E3A8A, #2563EB, #1E3A8A, #0F1622, transparent)",
          }}
        />

        {/* Tagline */}
        <p className="fade-up mt-2 max-w-md font-arabic text-base text-gray sm:text-lg">
          {BRAND.tagline}
        </p>

        {/* Trust badge */}
        <div className="fade-up mt-4 flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/5 px-4 py-2 backdrop-blur-sm">
          <Sparkles className="h-3.5 w-3.5 text-emerald neon-text-emerald" />
          <span className="font-arabic text-xs text-emerald">
            توصيل سريع لكل الولايات · الدفع عند الاستلام
          </span>
        </div>
      </div>
    </section>
  );
}
