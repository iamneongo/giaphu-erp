"use client";

import * as React from "react";

import { Plus, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

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
  type?: "text" | "tel" | "number" | "date" | "textarea" | "select" | "checkbox" | "hidden";
  value?: string | number | boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  validate?: (value: string, payload: FormPayload) => string | undefined;
  deriveValue?: (payload: FormPayload) => string | number | boolean | undefined;
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

function focusField(form: HTMLFormElement, fieldName: string) {
  const control = form.elements.namedItem(fieldName);

  if (control instanceof HTMLElement) {
    control.focus();
  }
}

function buildInitialValues(fields: FormFieldDefinition[]) {
  const payload: FormPayload = {};

  for (const field of fields) {
    payload[field.name] = field.value ?? "";
  }

  for (const field of fields) {
    const derivedValue = field.deriveValue?.(payload);
    if (derivedValue !== undefined) {
      payload[field.name] = derivedValue;
    }
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
  trigger,
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action: string;
  button: string;
  fields: FormFieldDefinition[];
  onAction: (action: string, payload: FormPayload) => Promise<boolean | undefined>;
  initialOpen?: boolean;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = React.useState(initialOpen);
  const [fieldValues, setFieldValues] = React.useState<FormPayload>(() => buildInitialValues(fields));
  const [pending, startTransition] = React.useTransition();

  const resolvedOpen = open ?? internalOpen;

  const setResolvedOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (open === undefined) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, open],
  );

  React.useEffect(() => {
    if (initialOpen && open === undefined) {
      setInternalOpen(true);
    }
  }, [initialOpen, open]);

  React.useEffect(() => {
    if (resolvedOpen) {
      setFieldValues(buildInitialValues(fields));
    }
  }, [fields, resolvedOpen]);

  const updateFieldValue = React.useCallback(
    (name: string, value: string | number | boolean) => {
      setFieldValues((current) => {
        const next = { ...current, [name]: value };

        for (const field of fields) {
          const derivedValue = field.deriveValue?.(next);
          if (derivedValue !== undefined) {
            next[field.name] = derivedValue;
          }
        }

        return next;
      });
    },
    [fields],
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = collectFormPayload(form);
    const missingField = fields.find((field) => {
      if (!field.required || field.disabled || field.type === "checkbox" || field.type === "hidden") {
        return false;
      }

      return !String(payload[field.name] ?? "").trim();
    });

    if (missingField) {
      toast.error(`Thiếu ${missingField.label.toLowerCase()}.`);
      focusField(form, missingField.name);
      return;
    }

    const invalidField = fields
      .map((field) => ({
        field,
        message:
          field.disabled || field.type === "checkbox" || field.type === "hidden"
            ? undefined
            : field.validate?.(String(payload[field.name] ?? ""), payload),
      }))
      .find((result) => result.message);

    if (invalidField?.message) {
      toast.error(invalidField.message);
      focusField(form, invalidField.field.name);
      return;
    }

    startTransition(async () => {
      const shouldClose = await onAction(action, payload);
      if (shouldClose !== false) {
        setResolvedOpen(false);
      }
    });
  }

  return (
    <Dialog open={resolvedOpen} onOpenChange={setResolvedOpen}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm">
              <Icon />
              {button}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <Form onSubmit={submit} noValidate className="space-y-4">
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => {
              if (field.type === "hidden") {
                return <Input key={field.name} type="hidden" name={field.name} value={String(field.value ?? "")} />;
              }

              if (field.type === "checkbox") {
                return (
                  <Field key={field.name} orientation="horizontal" className="rounded-lg border p-3">
                    <Checkbox name={field.name} defaultChecked={Boolean(field.value)} disabled={field.disabled} />
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
                      value={String(fieldValues[field.name] ?? "")}
                      placeholder={field.placeholder}
                      required={field.required}
                      disabled={field.disabled}
                      readOnly={field.readOnly}
                      onChange={(event) => updateFieldValue(field.name, event.target.value)}
                    />
                  ) : field.type === "date" ? (
                    <DatePickerField
                      name={field.name}
                      value={fieldValues[field.name] as string | number | boolean | undefined}
                      placeholder={field.placeholder}
                      required={field.required}
                      onValueChange={(value) => updateFieldValue(field.name, value)}
                    />
                  ) : field.type === "select" ? (
                    <Select
                      name={field.name}
                      value={String(fieldValues[field.name] ?? "")}
                      required={field.required}
                      disabled={field.disabled}
                      onValueChange={(value) => updateFieldValue(field.name, value)}
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
                      value={String(fieldValues[field.name] ?? "")}
                      placeholder={field.placeholder}
                      required={field.required}
                      disabled={field.disabled}
                      readOnly={field.readOnly}
                      inputMode={field.inputMode}
                      onChange={(event) => updateFieldValue(field.name, event.target.value)}
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
