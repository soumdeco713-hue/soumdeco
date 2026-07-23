"use client";

import Image from "next/image";
import { BRAND } from "@/lib/brand-config";

export function Hero() {
  return (
    <section
      id="accueil"
      className="relative flex flex-col items-center justify-center overflow-hidden px-6 pt-16 pb-8 sm:pt-24 sm:pb-12"
      dir="rtl"
      lang="ar"
    >
      {/* Soft warm halos in the background — pure CSS animations.
          Brass + rose + sage — like sunlight filtering through linen. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="float-strong absolute -top-10 right-10 h-72 w-72 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(154, 126, 58, 0.18) 0%, transparent 70%)",
            filter: "blur(45px)",
          }}
        />
        <div
          className="float-strong absolute top-20 -left-10 h-80 w-80 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(212, 165, 165, 0.14) 0%, transparent 70%)",
            filter: "blur(55px)",
            animationDelay: "1.5s",
          }}
        />
        <div
          className="float-strong absolute bottom-0 right-1/3 h-64 w-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(143, 166, 142, 0.12) 0%, transparent 70%)",
            filter: "blur(45px)",
            animationDelay: "3s",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Refined logo with brass-taupe ring */}
        <div className="fade-up relative mb-6 h-20 w-20 sm:h-24 sm:w-24">
          {/* Soft pulsing glow */}
          <div
            aria-hidden
            className="pulse-soft absolute -inset-4 rounded-full"
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

        {/* Brand name — elegant Cormorant Garamond serif, light weight,
            shimmering charcoal-brass gradient. Big and refined, not bold.
            letter-reveal animation: starts wide+blurred, settles into place. */}
        <h1
          className="fade-up font-serif text-5xl font-medium tracking-[0.08em] sm:text-7xl"
          style={{ lineHeight: 1.05 }}
        >
          <span className="text-blue-black-animated letter-reveal">{BRAND.name}</span>
        </h1>

        {/* Decorative brass divider — elegant line with center dot */}
        <div
          className="fade-up mt-5 flex items-center gap-2"
          style={{ animationDelay: "0.15s" }}
        >
          <div
            className="h-[1px] w-16 sm:w-24 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, transparent, #9A7E3A 60%, #B89656)",
            }}
          />
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "#9A7E3A", boxShadow: "0 0 8px rgba(154, 126, 58, 0.5)" }}
          />
          <div
            className="h-[1px] w-16 sm:w-24 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, #B89656, #9A7E3A 40%, transparent)",
            }}
          />
        </div>

        {/* Tagline — elegant italic Cormorant, larger and prominent.
            Animated with a slow shimmer + gentle float. */}
        <p
          className="fade-up mt-6 max-w-xl font-serif text-xl italic tracking-wide sm:text-3xl"
          style={{ animationDelay: "0.3s" }}
        >
          <span
            className="text-blue-black-animated tagline-float"
            style={{ display: "inline-block" }}
          >
            {BRAND.tagline}
          </span>
        </p>
      </div>
    </section>
  );
}
