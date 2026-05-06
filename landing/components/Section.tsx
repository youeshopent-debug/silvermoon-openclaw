import { ReactNode } from "react";

export function Section(props: {
  id?: string;
  title?: string;
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <section id={props.id} className="mx-auto w-full max-w-5xl px-5 py-20 sm:py-24">
      {props.kicker ? (
        <div className="text-xs font-semibold tracking-widest uppercase text-accent">
          {props.kicker}
        </div>
      ) : null}
      {props.title ? (
        <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-text-primary">
          {props.title}
        </h2>
      ) : null}
      <div className="mt-8">{props.children}</div>
    </section>
  );
}
