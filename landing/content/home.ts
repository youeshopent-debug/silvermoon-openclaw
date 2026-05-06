export interface ServiceCard {
  titleKey: string;
  bodyKey: string;
}

export interface CaseStudy {
  titleKey: string;
  image: string;
  points: string[];
}

export interface HomeContent {
  meta: {
    title: string;
    description: string;
  };
  hero: {
    headline: string;
    subtitle: string;
    tags: string[];
  };
  services: {
    kicker: string;
    title: string;
    cards: ServiceCard[];
  };
  caseStudies: {
    kicker: string;
    title: string;
    cases: CaseStudy[];
  };
}

export const homeContent: HomeContent = {
  meta: {
    title: "Automation & Agent Orchestration (Node.js)",
    description:
      "Discord automation, scheduled reports, webhook/payment pipelines, evidence-based delivery.",
  },
  hero: {
    headline: "Automation & Agent Orchestration (Node.js)",
    subtitle:
      "Discord bots • Scheduled reports • Webhook/payment pipelines • Evidence-based delivery",
    tags: [
      "Checkout + Webhooks",
      "Subscriptions + Billing",
      "Connect / Marketplace",
      "Fraud‑aware pipelines",
    ],
  },
  services: {
    kicker: "Services",
    title: "What I build",
    cards: [
      {
        titleKey: "landing.services.discord.title",
        bodyKey: "landing.services.discord.body",
      },
      {
        titleKey: "landing.services.webhook.title",
        bodyKey: "landing.services.webhook.body",
      },
      {
        titleKey: "landing.services.agent.title",
        bodyKey: "landing.services.agent.body",
      },
    ],
  },
  caseStudies: {
    kicker: "Proof",
    title: "Case studies",
    cases: [
      {
        titleKey: "landing.cases.discordOps.title",
        image: "/assets/ops_control.png",
        points: [
          "Local ops control panel with periodic refresh",
          "Daily dedupe marker prevents double posting",
          "Archived outputs for evidence-based verification",
        ],
      },
      {
        titleKey: "landing.cases.webhookPipeline.title",
        image: "/assets/stripe_ledger.png",
        points: [
          "Signature verification with constant-time compare",
          "Idempotency window with reboot recovery",
          "Write-ahead JSONL ledger + error/event diagnostics",
        ],
      },
    ],
  },
};
