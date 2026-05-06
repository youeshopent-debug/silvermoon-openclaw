export type Locale = "en";

const labels: Record<string, string> = {
  "landing.cta.contact": "Contact",
  "landing.cta.upwork": "Contact via Upwork",
  "landing.cta.fiverr": "Contact via Fiverr",
  "landing.cta.requestQuote": "Request a quote",
  "landing.cta.unavailable": "Contact form unavailable",
  "landing.cta.upworkProfile": "Upwork profile",

  "landing.services.discord.title": "Discord Automation",
  "landing.services.discord.body":
    "Briefs, reminders, ops dashboards, reliability-first scheduling and dedupe gates.",
  "landing.services.webhook.title": "Webhook Pipelines",
  "landing.services.webhook.body":
    "Signature verification, idempotency, local ledger (JSONL), and error diagnostics.",
  "landing.services.agent.title": "Agent Workflows",
  "landing.services.agent.body":
    "Orchestrated tasks with evidence-based outputs and safety stops before irreversible actions.",

  "landing.cases.discordOps.title": "Discord Automation: Ops Dashboard + Scheduled Briefs",
  "landing.cases.webhookPipeline.title": "Webhook Pipeline: Verify + Dedupe + Local Ledger",
};

export function t(key: string): string {
  return labels[key] ?? key;
}
