const UPWORK_URL = "https://www.upwork.com/freelancers/~01c1ade1ca83c8e544";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-5xl px-5 py-10 text-sm text-zinc-600">
        <div>Timezone: UTC+8 (Malaysia)</div>
        <div className="mt-2">
          <a
            className="underline underline-offset-4 hover:text-zinc-900"
            href={UPWORK_URL}
            target="_blank"
            rel="noreferrer"
          >
            Upwork profile
          </a>
        </div>
      </div>
    </footer>
  );
}

