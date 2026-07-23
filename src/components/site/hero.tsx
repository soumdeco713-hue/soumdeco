"use client";

import Image from "next/image";
import { BRAND } from "@/lib/brand-config";

export function Hero() {
  return (
    <section
      id="accueil"
      className="relative flex flex-col items-center justify-center overflow-hidden px-6 pt-20 pb-8 sm:pt-28 sm:pb-12"
    >
      {/* Static warm halos in the background — NO animation (CPU friendly).
          Brass + rose + sage — like sunlight through linen. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-10 right-10 h-72 w-72 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(154, 126, 58, 0.18) 0%, transparent 70%)",
            filter: "blur(45px)",
          }}
        />
        <div
          className="absolute top-20 -left-10 h-80 w-80 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(212, 165, 165, 0.14) 0%, transparent 70%)",
            filter: "blur(55px)",
          }}
        />
        <div
          className="absolute bottom-0 right-1/3 h-64 w-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(143, 166, 142, 0.12) 0%, transparent 70%)",
            filter: "blur(45px)",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Logo with brass-taupe ring — static glow (no pulse, CPU friendly) */}
        <div className="fade-up relative mb-6 h-20 w-20 sm:h-20 sm:w-20">
          {/* Static soft glow */}
          <div
            aria-hidden
            className="absolute -inset-4 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(154, 126, 58, 0.25) 0%, transparent 70%)",
              filter: "blur(14px)",
            }}
          />
          {/* Brass-taupe ring */}
          <div className="neon-ring absolute inset-0 rounded-full p-[3px]">
            <div className="h-full w-full overflow-hidden rounded-full bg-cream">
              <Image
                src={BRAND.logoPath}
                alt={`${BRAND.name} logo`}
                width={120}
                height={120}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </div>
        </div>

        {/* Brand name — SOUM DECO with gray-to-gold slow gradient glow.
            Cormorant Garamond serif, semibold, tight tracking. */}
        <h1 className="fade-up flex items-center justify-center gap-4 font-serif text-5xl font-semibold tracking-tight sm:text-6xl">
          <span className="text-soum-deco-glow">SOUM</span>
          <span className="text-soum-deco-glow">DECO</span>
        </h1>

        {/* Tagline — plain italic gray, no glow. */}
        <p className="fade-up mt-3 max-w-md font-serif text-lg italic text-gray sm:text-xl">
          {BRAND.tagline}
        </p>
      </div>
    </section>
  );
}
