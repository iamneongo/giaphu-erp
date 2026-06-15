"use client";

import type { ReactNode } from "react";

type SectionBlockProps = {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
};

export function SectionBlock({ title, meta, children }: SectionBlockProps) {
  void title;
  void meta;

  return <section className="space-y-3">{children}</section>;
}
