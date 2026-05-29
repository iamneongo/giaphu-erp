"use client";

import * as React from "react";

import { Loader2, MoreHorizontal, Pencil } from "lucide-react";

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
  onSelect: () => Promise<unknown> | undefined;
  destructive?: boolean;
  disabled?: boolean;
};

type EditActionConfig = {
  title: string;
  description?: string;
  action: string;
  fields: FormFieldDefinition[];
  onAction: (action: string, payload: FormPayload) => Promise<unknown>;
};

export function TableRowActions({ edit, actions = [] }: { edit?: EditActionConfig; actions?: RowActionItem[] }) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const isPending = pendingAction != null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={isPending ? "Đang xử lý thao tác dòng" : "Mở thao tác dòng"}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
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
            const isItemPending = pendingAction === item.label;

            return (
              <DropdownMenuItem
                key={item.label}
                variant={item.destructive ? "destructive" : "default"}
                disabled={isPending || item.disabled}
                onSelect={(event) => {
                  event.preventDefault();
                  const result = item.onSelect();

                  if (!result) {
                    return;
                  }

                  setPendingAction(item.label);
                  void result.finally(() => {
                    setPendingAction(null);
                  });
                }}
              >
                {isItemPending ? <Loader2 className="animate-spin" /> : Icon ? <Icon /> : null}
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
