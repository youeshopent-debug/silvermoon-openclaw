import type { ContactChannels } from "./contact-channels";

export type CtaForm = { type: "form"; href: "#contact"; labelKey: string };
export type CtaExternal = { type: "external"; href: string; labelKey: string };
export type CtaDisabled = { type: "disabled"; labelKey: string };

export type CtaType = CtaForm | CtaExternal | CtaDisabled;
export type CtaWithHref = CtaForm | CtaExternal;

export function resolveUpworkCta(channels: ContactChannels): CtaExternal {
  return { type: "external", href: channels.upworkUrl, labelKey: "landing.cta.upwork" };
}

export function resolveFiverrCta(channels: ContactChannels): CtaExternal | null {
  if (channels.fiverrUrl) {
    return { type: "external", href: channels.fiverrUrl, labelKey: "landing.cta.fiverr" };
  }
  return null;
}

export function resolveContactCta(channels: ContactChannels): CtaWithHref {
  if (channels.formEndpoint) {
    return { type: "form", href: "#contact", labelKey: "landing.cta.contact" };
  }
  return { type: "external", href: channels.upworkUrl, labelKey: "landing.cta.contact" };
}

export function resolveRequestQuoteCta(channels: ContactChannels): CtaType {
  if (channels.formEndpoint) {
    return { type: "form", href: "#contact", labelKey: "landing.cta.requestQuote" };
  }
  if (channels.upworkUrl) {
    return { type: "external", href: channels.upworkUrl, labelKey: "landing.cta.requestQuote" };
  }
  return { type: "disabled", labelKey: "landing.cta.unavailable" };
}

export function resolveFooterCta(channels: ContactChannels): CtaExternal {
  return { type: "external", href: channels.upworkUrl, labelKey: "landing.cta.upworkProfile" };
}
