import { ReactNode } from "react";

export function Section(props: {
  id?: string;
  title?: string;
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <section id={props.id} className="mx-auto w-full max-w-5xl px-5 py-16">
      {props.kicker ? (
        <div className="text-xs font-semibold tracking-wider text-zinc-500">
          {props.kicker}
        </div>
      ) : null}
      {props.title ? (
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
          {props.title}
        </h2>
      ) : null}
      <div className="mt-6">{props.children}</div>
    </section>
  );
}

