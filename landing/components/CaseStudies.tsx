import Image from "next/image";
import { Section } from "./Section";

const cases = [
  {
    title: "Discord Automation: Ops Dashboard + Scheduled Briefs",
    image: "/assets/ops_control.png",
    points: [
      "Local ops control panel with periodic refresh",
      "Daily dedupe marker prevents double posting",
      "Archived outputs for evidence-based verification",
    ],
  },
  {
    title: "Webhook Pipeline: Verify + Dedupe + Local Ledger",
    image: "/assets/stripe_ledger.png",
    points: [
      "Signature verification with constant-time compare",
      "Idempotency window with reboot recovery",
      "Write-ahead JSONL ledger + error/event diagnostics",
    ],
  },
];

export function CaseStudies() {
  return (
    <Section kicker="Proof" title="Case studies">
      <div className="grid gap-6">
        {cases.map((c) => (
          <div key={c.title} className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="grid gap-5 md:grid-cols-[320px_1fr] md:items-start">
              <div className="overflow-hidden rounded-lg border border-zinc-200">
                <Image
                  src={c.image}
                  alt={c.title}
                  width={1200}
                  height={720}
                  className="h-auto w-full"
                />
              </div>
              <div>
                <div className="text-lg font-semibold text-zinc-900">{c.title}</div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-600">
                  {c.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

