const footerColumns = [
  {
    title: "Services",
    links: [
      { label: "Discord Automation", href: "#services" },
      { label: "Webhook Pipelines", href: "#services" },
      { label: "Agent Orchestration", href: "#services" },
    ],
  },
  {
    title: "Case Studies",
    links: [
      { label: "Discord Ops Panel", href: "#case-studies" },
      { label: "Stripe Ledger", href: "#case-studies" },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: "Get in touch", href: "#contact" },
      { label: "Upwork", href: "https://www.upwork.com/freelancers/~0155771cfbb1a42618" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-bg-surface">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-sm font-semibold tracking-tight text-text-primary">
              ◈ SilverMoon Bank
            </div>
            <div className="mt-2 text-xs leading-5 text-text-secondary">
              AI automation gateway for the modern builder.
            </div>
          </div>
          {footerColumns.map((col) => (
            <div key={col.title}>
              <div className="text-xs font-semibold tracking-widest uppercase text-text-tertiary">
                {col.title}
              </div>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-white/[0.06] pt-6 text-center text-xs text-text-tertiary">
          &copy; {new Date().getFullYear()} SilverMoon Bank. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
