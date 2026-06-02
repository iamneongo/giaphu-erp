"use client";

import type { ReactNode } from "react";

type SectionBlockProps = {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
};

export function SectionBlock({ title, meta, children }: SectionBlockProps) {
  void title;

  return (
    <section className="space-y-3">
      {meta !== undefined && meta !== null ? <div className="flex justify-end px-1">{meta}</div> : null}
      {children}
    </section>
  );
}
