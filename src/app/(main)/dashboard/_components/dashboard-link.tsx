"use client";

import type * as React from "react";

import Link, { type LinkProps } from "next/link";

type DashboardLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | "href"> & LinkProps;

export function DashboardLink({ children, prefetch = false, ...props }: DashboardLinkProps) {
  return (
    <Link {...props} prefetch={prefetch}>
      {children}
    </Link>
  );
}
