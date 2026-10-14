import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found — BCF-SL",
};

export default function NotFound() {
  return (
    <div
      className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--surface)" }}
    >
      {/* BCF Logo */}
      <div className="mb-8">
        <div className="inline-block px-4 py-2 rounded-2xl bg-white/80 dark:bg-white/10 shadow-lg backdrop-blur-sm">
          <img
            src="/bcf-logo.jpg"
            alt="Bandama Charity Foundation"
            className="h-12 w-auto object-contain"
          />
        </div>
      </div>

      {/* Big 404 number */}
      <div
        className="text-[120px] sm:text-[160px] font-extrabold leading-none mb-4 select-none"
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          background: "linear-gradient(135deg, var(--primary), var(--secondary))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          opacity: 0.15,
        }}
        aria-hidden="true"
      >
        404
      </div>

      {/* Icon */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 -mt-16"
        style={{ background: "var(--surface-container)" }}
      >
        <span
          className="material-symbols-outlined text-[32px]"
          style={{ color: "var(--on-surface-variant)" }}
        >
          search_off
        </span>
      </div>

      <h1
        className="text-[24px] font-bold mb-3"
        style={{ color: "var(--on-surface)" }}
      >
        Page Not Found
      </h1>

      <p
        className="text-[14px] mb-8 max-w-sm leading-relaxed"
        style={{ color: "var(--on-surface-variant)" }}
      >
        We couldn&apos;t find the page you&apos;re looking for. It may have been removed or the URL 
        might be incorrect.
      </p>

      <Link
        href="/"
        id="not-found-home-btn"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold 
                   text-white transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}
      >
        <span className="material-symbols-outlined text-[18px]">home</span>
        Return to Hub
      </Link>

      {/* Footer brand */}
      <div className="mt-16 opacity-30">
        <img
          src="/bcf-logo.jpg"
          alt="BCF-SL"
          className="h-6 w-auto object-contain mx-auto"
        />
      </div>
    </div>
  );
}
