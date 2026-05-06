const UPWORK_URL = "https://www.upwork.com/freelancers/~01c1ade1ca83c8e544";

export interface ContactChannels {
  upworkUrl: string;
  formEndpoint: string | null;
  fiverrUrl: string | null;
}

function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function resolveChannels(): ContactChannels {
  const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT;
  const fiverrUrl = process.env.NEXT_PUBLIC_FIVERR_PROFILE_URL;

  return {
    upworkUrl: UPWORK_URL,
    formEndpoint: nonEmpty(endpoint) ? endpoint : null,
    fiverrUrl: nonEmpty(fiverrUrl) ? fiverrUrl : null,
  };
}

export function hasForm(channels: ContactChannels): boolean {
  return channels.formEndpoint !== null;
}

export function hasFiverr(channels: ContactChannels): boolean {
  return channels.fiverrUrl !== null;
}
