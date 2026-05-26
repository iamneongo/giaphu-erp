"use client";

import type { ReactNode } from "react";

type SectionBlockProps = {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
};

export function SectionBlock({ title, meta, children }: SectionBlockProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {meta !== undefined && meta !== null ? <div className="shrink-0">{meta}</div> : null}
      </div>
      {children}
    </section>
  );
}
