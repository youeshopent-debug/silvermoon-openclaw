import { Section } from "./Section";

const bullets = [
  "Evidence-based delivery (files/logs/screenshots) for clear verification",
  "Reliability-first (dedupe gates, persistence, defensive error handling)",
  "No irreversible action without confirmation (submit/publish/payment)",
];

export function WorkingStyle() {
  return (
    <Section kicker="Process" title="Working style">
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-600">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

