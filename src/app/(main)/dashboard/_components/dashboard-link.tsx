"use client";

import * as React from "react";

import Link, { type LinkProps } from "next/link";

import { navigateWithDocument } from "@/lib/navigation/document-navigation";

type DashboardLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | "href"> &
  LinkProps & {
    documentNavigation?: boolean;
  };

export function DashboardLink({
  children,
  documentNavigation = true,
  onClick,
  prefetch = false,
  target,
  ...props
}: DashboardLinkProps) {
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (!documentNavigation || event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
      if (target && target !== "_self") return;

      event.preventDefault();
      navigateWithDocument(event.currentTarget.href);
    },
    [documentNavigation, onClick, target],
  );

  return (
    <Link {...props} prefetch={prefetch} target={target} onClick={handleClick}>
      {children}
    </Link>
  );
}
