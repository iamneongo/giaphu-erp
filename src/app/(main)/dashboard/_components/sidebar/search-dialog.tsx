"use client";

import * as React from "react";

import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  ACTIVE_PROJECT_CHANGE_EVENT,
  type ActiveProjectChangeDetail,
  readActiveProjectCode,
  readActiveProjectRouteId,
} from "@/lib/giaphu-erp/project-context";
import { erpPathForProject } from "@/lib/giaphu-erp/project-routes";
import { navigateWithDocument } from "@/lib/navigation/document-navigation";
import type { NavMainItem } from "@/navigation/sidebar/sidebar-items";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";

type SearchItem = {
  group: string;
  label: string;
  url: string;
  icon?: NavMainItem["icon"];
  disabled?: boolean;
  newTab?: boolean;
};

const sidebarGroupLabels = new Set(sidebarItems.flatMap((group) => (group.label ? [group.label] : [])));

function getSubItemGroup(groupLabel: string | undefined, itemTitle: string) {
  return sidebarGroupLabels.has(itemTitle) ? (groupLabel ?? "Khác") : itemTitle;
}

const searchItems: SearchItem[] = sidebarItems.flatMap((group) =>
  group.items.flatMap((item) => {
    if (item.subItems) {
      return item.subItems.map((sub) => ({
        group: getSubItemGroup(group.label, item.title),
        label: sub.title,
        url: sub.url,
        icon: item.icon,
        disabled: sub.comingSoon,
        newTab: sub.newTab,
      }));
    }

    return [
      {
        group: group.label ?? "Khác",
        label: item.title,
        url: item.url,
        icon: item.icon,
        disabled: item.comingSoon,
        newTab: item.newTab,
      },
    ];
  }),
);

function getAvailableItems(items: SearchItem[]) {
  return items.filter((item) => !item.disabled && !item.url.includes("coming-soon"));
}

const recommendations = getAvailableItems(searchItems);

function groupBy(items: SearchItem[]) {
  const groups = [...new Set(items.map((item) => item.group))];
  return groups.map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  }));
}

export function SearchDialog() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeProjectRouteId, setActiveProjectRouteId] = React.useState("");

  React.useEffect(() => {
    setActiveProjectRouteId(readActiveProjectRouteId() || readActiveProjectCode());

    function handleProjectChange(event: Event) {
      const detail = (event as CustomEvent<ActiveProjectChangeDetail>).detail;
      const nextCode = detail?.code;
      if (nextCode) {
        setActiveProjectRouteId(detail.routeId || nextCode);
      }
    }

    window.addEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);

    return () => {
      window.removeEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);
    };
  }, []);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) setQuery("");
  };

  const handleSelect = (item: SearchItem) => {
    if (item.disabled) return;
    handleOpenChange(false);
    const href = activeProjectRouteId ? erpPathForProject(activeProjectRouteId, item.url) : item.url;

    if (item.newTab) {
      window.open(href, "_blank", "noopener,noreferrer");
    } else {
      navigateWithDocument(href);
    }
  };

  const renderGroups = (items: SearchItem[]) =>
    groupBy(items).map(({ group, items: groupItems }, index) => (
      <React.Fragment key={group}>
        {index > 0 && <CommandSeparator />}
        <CommandGroup heading={group}>
          {groupItems.map((item) => (
            <CommandItem
              disabled={item.disabled}
              key={`${group}-${item.url}-${item.label}`}
              value={`${item.group} ${item.label}`}
              onSelect={() => handleSelect(item)}
            >
              {item.icon && <item.icon />}
              <span>{item.label}</span>

              {item.disabled && (
                <Badge variant="outline" className="text-xs">
                  Sắp có
                </Badge>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </React.Fragment>
    ));

  return (
    <>
      <Button
        onClick={() => handleOpenChange(true)}
        type="button"
        variant="outline"
        className="relative h-9 w-full justify-start rounded-lg bg-background pr-12 font-normal text-muted-foreground shadow-none md:w-48 lg:w-64"
      >
        <Search data-icon="inline-start" />
        Tìm kiếm
        <kbd className="pointer-events-none absolute top-1/2 right-1.5 inline-flex h-6 -translate-y-1/2 select-none items-center gap-1 rounded-md border bg-muted px-1.5 font-medium font-mono text-[10px]">
          <span className="text-xs">⌘</span>J
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Tìm kiếm module"
        description="Tìm module, hồ sơ và báo cáo trong hệ thống Gia Phú ERP."
      >
        <Command>
          <CommandInput placeholder="Tìm module, hồ sơ, báo cáo..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Không tìm thấy kết quả.</CommandEmpty>
            {query ? renderGroups(searchItems) : renderGroups(recommendations)}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
