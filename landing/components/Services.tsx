import { Section } from "./Section";

const items = [
  {
    title: "Discord Automation",
    body: "Briefs, reminders, ops dashboards, reliability-first scheduling and dedupe gates.",
  },
  {
    title: "Webhook Pipelines",
    body: "Signature verification, idempotency, local ledger (JSONL), and error diagnostics.",
  },
  {
    title: "Agent Workflows",
    body: "Orchestrated tasks with evidence-based outputs and safety stops before irreversible actions.",
  },
];

export function Services() {
  return (
    <Section kicker="Services" title="What I build">
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.title} className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="text-base font-semibold text-zinc-900">{it.title}</div>
            <div className="mt-2 text-sm leading-6 text-zinc-600">{it.body}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

