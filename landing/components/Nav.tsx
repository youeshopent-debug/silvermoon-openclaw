"use client";

import { useState, useEffect, useRef } from "react";

const sections = [
  { label: "Services", href: "#services" },
  { label: "Case Studies", href: "#case-studies" },
  { label: "Contact", href: "#contact" },
];

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-bg-deep/80 backdrop-blur-xl border-b border-white/[0.06]"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
        <a href="/" className="text-sm font-semibold tracking-tight text-text-primary">
          ◈ SilverMoon Bank
        </a>
        <nav className="hidden md:flex items-center gap-6">
          {sections.map((s) => (
            <button
              key={s.href}
              onClick={() => scrollTo(s.href.slice(1))}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div ref={ref} className="relative md:hidden">
          <button
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-text-primary"
          >
            Menu
            <svg
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-white/[0.10] bg-bg-elevated py-1 shadow-lg">
              {sections.map((s) => (
                <button
                  key={s.href}
                  onClick={() => {
                    scrollTo(s.href.slice(1));
                    setOpen(false);
                  }}
                  className="flex w-full items-center px-3 py-1.5 text-left text-sm text-text-secondary hover:text-text-primary hover:bg-white/[0.04]"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
