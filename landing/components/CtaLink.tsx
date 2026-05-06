import type { CtaType } from "../lib/cta-resolver";
import { t } from "../lib/labels";

export function CtaLink({ cta, className }: { cta: CtaType; className?: string }) {
  if (cta.type === "disabled") {
    return (
      <span className={`inline-flex items-center justify-center rounded-lg bg-white/[0.04] px-4 py-2 text-sm font-medium text-text-tertiary cursor-not-allowed ${className ?? ""}`}>
        {t(cta.labelKey)}
      </span>
    );
  }

  return (
    <a
      href={cta.href}
      className={className}
      target={cta.type === "external" ? "_blank" : undefined}
      rel={cta.type === "external" ? "noreferrer" : undefined}
    >
      {t(cta.labelKey)}
    </a>
  );
}
