"use client";

import * as React from "react";

import { Plus, RefreshCw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { DatePickerField } from "./date-picker-field";

export interface FormFieldDefinition {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select" | "checkbox" | "hidden";
  value?: string | number | boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
}

export type FormPayload = Record<string, unknown>;

export function collectFormPayload(form: HTMLFormElement) {
  const data = new FormData(form);
  const payload: FormPayload = {};

  for (const [key, value] of data.entries()) {
    payload[key] = value instanceof File ? value.name : value;
  }

  for (const input of Array.from(form.querySelectorAll<HTMLInputElement>("input[type=checkbox]"))) {
    payload[input.name] = input.checked;
  }

  return payload;
}

export function ActionDialog({
  title,
  description,
  icon: Icon = Plus,
  action,
  button,
  fields,
  onAction,
  initialOpen = false,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action: string;
  button: string;
  fields: FormFieldDefinition[];
  onAction: (action: string, payload: FormPayload) => Promise<void>;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(initialOpen);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (initialOpen) {
      setOpen(true);
    }
  }, [initialOpen]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = collectFormPayload(event.currentTarget);

    startTransition(async () => {
      await onAction(action, payload);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Icon />
          {button}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <Form onSubmit={submit} className="space-y-4">
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => {
              if (field.type === "hidden") {
                return <Input key={field.name} type="hidden" name={field.name} value={String(field.value ?? "")} />;
              }

              if (field.type === "checkbox") {
                return (
                  <Field key={field.name} orientation="horizontal" className="rounded-lg border p-3">
                    <Checkbox name={field.name} defaultChecked={Boolean(field.value)} />
                    <FieldLabel>{field.label}</FieldLabel>
                  </Field>
                );
              }

              return (
                <Field key={field.name} className={field.type === "textarea" ? "md:col-span-2" : undefined}>
                  <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={field.name}
                      name={field.name}
                      defaultValue={String(field.value ?? "")}
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  ) : field.type === "date" ? (
                    <DatePickerField
                      name={field.name}
                      value={field.value}
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  ) : field.type === "select" ? (
                    <Select
                      name={field.name}
                      defaultValue={String(field.value ?? "")}
                      required={field.required}
                    >
                      <SelectTrigger id={field.name} className="w-full">
                        <SelectValue placeholder={field.placeholder ?? `Chọn ${field.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                      {(field.options ?? []).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={field.name}
                      name={field.name}
                      type={field.type ?? "text"}
                      defaultValue={String(field.value ?? "")}
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  )}
                </Field>
              );
            })}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <RefreshCw className="animate-spin" /> : <Save />}
              Lưu
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
