export function navigateWithDocument(href: string) {
  if (typeof window === "undefined") return;
  window.location.assign(href);
}
