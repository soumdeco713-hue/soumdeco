"use client";

import { BRAND } from "@/lib/brand-config";

export function BrandStory() {
  return (
    <section
      id="apropos"
      className="px-4 py-14 sm:px-6 sm:py-20"
     
     
    >
      <div className="mx-auto max-w-3xl">
        <div
          className="fade-up relative overflow-hidden rounded-3xl border border-emerald/25 bg-night-soft/60 p-6 backdrop-blur-md sm:p-12"
          style={{
            boxShadow:
              "0 16px 48px -12px rgba(107, 100, 87, 0.15), 0 0 0 1px rgba(42, 125, 91, 0.15), 0 0 60px -20px rgba(42, 125, 91, 0.4)",
          }}
        >
          {/* Decorative neon orbs */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full opacity-50"
            style={{
              background: "radial-gradient(circle, rgba(42, 125, 91, 0.35) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full opacity-40"
            style={{
              background: "radial-gradient(circle, rgba(194, 91, 126, 0.25) 0%, transparent 70%)",
              filter: "blur(45px)",
            }}
          />

          <div className="relative">
            <h2 className="fade-up text-center font-arabic text-3xl font-bold text-charcoal sm:text-5xl">
              <span className="text-blue-black-animated">{BRAND.story.title}</span>
            </h2>
            <div
              className="fade-up mx-auto mt-4 h-[2px] w-16 rounded-full"
              style={{
                background: "linear-gradient(90deg, transparent, #B8902F, transparent)",
              }}
            />

            {BRAND.story.paragraphs.map((p, i) => (
              <p
                key={i}
                className="fade-up mt-6 text-center font-arabic text-base leading-loose text-gray sm:text-lg"
              >
                {p}
              </p>
            ))}

            <div className="fade-up mt-10 grid grid-cols-3 gap-4">
              {BRAND.story.stats.map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-center rounded-2xl border border-emerald/20 bg-night/50 px-3 py-6 text-center backdrop-blur-sm transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <span className="text-gold-gradient font-arabic text-3xl font-bold neon-text-gold sm:text-4xl">
                    {s.value}
                  </span>
                  <span className="mt-2 font-arabic text-xs text-gray sm:text-sm">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
