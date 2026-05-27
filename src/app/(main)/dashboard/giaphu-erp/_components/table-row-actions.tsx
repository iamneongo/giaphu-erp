"use client";

import * as React from "react";

import { MoreHorizontal, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ActionDialog, type FormFieldDefinition, type FormPayload } from "./action-dialog";

type RowActionItem = {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type EditActionConfig = {
  title: string;
  description?: string;
  action: string;
  fields: FormFieldDefinition[];
  onAction: (action: string, payload: FormPayload) => Promise<void>;
};

export function TableRowActions({
  edit,
  actions = [],
}: {
  edit?: EditActionConfig;
  actions?: RowActionItem[];
}) {
  const [editOpen, setEditOpen] = React.useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="Mở thao tác dòng">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {edit ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setEditOpen(true);
              }}
            >
              <Pencil />
              Sửa
            </DropdownMenuItem>
          ) : null}
          {edit && actions.length ? <DropdownMenuSeparator /> : null}
          {actions.map((item) => {
            const Icon = item.icon;

            return (
              <DropdownMenuItem
                key={item.label}
                variant={item.destructive ? "destructive" : "default"}
                disabled={item.disabled}
                onSelect={(event) => {
                  event.preventDefault();
                  item.onSelect();
                }}
              >
                {Icon ? <Icon /> : null}
                {item.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {edit ? (
        <ActionDialog
          title={edit.title}
          description={edit.description}
          action={edit.action}
          button="Sửa"
          fields={edit.fields}
          onAction={edit.onAction}
          open={editOpen}
          onOpenChange={setEditOpen}
          hideTrigger
        />
      ) : null}
    </>
  );
}
