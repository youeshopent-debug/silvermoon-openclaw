import { Section } from "./Section";

const faqs = [
  {
    q: "What does evidence-based delivery mean?",
    a: "Each workflow produces verifiable artifacts (logs/files/screenshots), so you can confirm outputs before anything irreversible.",
  },
  {
    q: "What access do you need?",
    a: "Depends on scope. Typically: target platform access + required API keys. Secrets are never logged and are kept out of deliverables.",
  },
  {
    q: "Do you provide maintenance?",
    a: "Yes. I can provide monitoring, fixes, and iterative improvements after initial delivery.",
  },
  {
    q: "Can you handle urgent requests?",
    a: "If the scope is tight and access is ready, urgent delivery is possible. I’ll confirm constraints before starting.",
  },
];

export function FAQ() {
  return (
    <Section kicker="FAQ" title="Common questions">
      <div className="grid gap-4">
        {faqs.map((f) => (
          <div key={f.q} className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="text-sm font-semibold text-zinc-900">{f.q}</div>
            <div className="mt-2 text-sm leading-6 text-zinc-600">{f.a}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

