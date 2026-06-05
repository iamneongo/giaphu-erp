"use client";

import * as React from "react";

import { Check, ChevronsUpDown, Plus, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { DatePickerField } from "./date-picker-field";
import { ProjectPinInput } from "./project-pin-input";

export interface FormFieldDefinition {
  name: string;
  label: string;
  type?: "text" | "tel" | "number" | "date" | "textarea" | "select" | "checkbox" | "hidden" | "file" | "password";
  value?: string | number | boolean;
  placeholder?: string;
  helperText?: string;
  accept?: string;
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  validate?: (value: string, payload: FormPayload) => string | undefined;
  deriveValue?: (payload: FormPayload) => string | number | boolean | undefined;
  visibleWhen?: (payload: FormPayload) => boolean;
  defaultValueWhen?: (payload: FormPayload) => string | number | boolean | undefined;
}

export type FormPayload = Record<string, unknown>;

export function collectFormPayload(form: HTMLFormElement) {
  const data = new FormData(form);
  const payload: FormPayload = {};

  for (const [key, value] of data.entries()) {
    payload[key] = value instanceof File ? (value.size > 0 ? value : "") : value;
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

function getResolvedFieldType(field: FormFieldDefinition) {
  if (field.type) return field.type;
  if (field.name === "description" || field.label.toLowerCase().includes("diễn giải")) return "textarea";
  return "text";
}

function SearchableFormSelect({
  id,
  name,
  label,
  value,
  options,
  placeholder,
  disabled,
  dialogOpen,
  required,
  onValueChange,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
  disabled?: boolean;
  dialogOpen: boolean;
  required?: boolean;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const displayValue = selectedOption?.label ?? value;
  const resolvedPlaceholder = placeholder ?? `Chọn ${label.toLowerCase()}`;

  React.useEffect(() => {
    if (!dialogOpen) setOpen(false);
  }, [dialogOpen]);

  return (
    <>
      <input disabled={disabled} name={name} readOnly required={required} type="hidden" value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            className={cn("h-9 w-full justify-between rounded-md px-3 font-normal", !value && "text-muted-foreground")}
            disabled={disabled}
            id={id}
            role="combobox"
            type="button"
            variant="outline"
          >
            <span className="truncate">{displayValue || resolvedPlaceholder}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter>
            <CommandInput placeholder={`Tìm ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>Không có dữ liệu phù hợp.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={`${name}-${option.value}`}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", value === option.value ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
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
  onAction: (action: string, payload: FormPayload) => Promise<unknown>;
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

  React.useEffect(() => {
    if (resolvedOpen) return;

    const timeout = window.setTimeout(() => {
      if (!document.querySelector('[role="dialog"]')) {
        document.body.style.pointerEvents = "";
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [resolvedOpen]);

  const updateFieldValue = React.useCallback(
    (name: string, value: string | number | boolean) => {
      setFieldValues((current) => {
        const next = { ...current, [name]: value };

        for (const field of fields) {
          const defaultValue = field.defaultValueWhen?.(next);
          if (defaultValue !== undefined && !String(next[field.name] ?? "").trim()) {
            next[field.name] = defaultValue;
          }

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
    const visibleFields = fields.filter((field) => field.visibleWhen?.(payload) ?? true);
    const missingField = visibleFields.find((field) => {
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

    const invalidField = visibleFields
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
              const fieldType = getResolvedFieldType(field);
              const isVisible = field.visibleWhen?.(fieldValues) ?? true;
              if (!isVisible) return null;

              if (fieldType === "hidden") {
                return (
                  <Input
                    key={field.name}
                    type="hidden"
                    name={field.name}
                    value={String(fieldValues[field.name] ?? "")}
                  />
                );
              }

              if (fieldType === "checkbox") {
                return (
                  <Field key={field.name} orientation="horizontal" className="rounded-lg border p-3">
                    <Checkbox
                      name={field.name}
                      checked={Boolean(fieldValues[field.name])}
                      disabled={field.disabled}
                      onCheckedChange={(value) => updateFieldValue(field.name, Boolean(value))}
                    />
                    <FieldLabel>{field.label}</FieldLabel>
                  </Field>
                );
              }

              return (
                <Field key={field.name} className={fieldType === "textarea" ? "md:col-span-2" : undefined}>
                  <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
                  {fieldType === "textarea" ? (
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
                  ) : fieldType === "date" ? (
                    <DatePickerField
                      name={field.name}
                      value={fieldValues[field.name] as string | number | boolean | undefined}
                      placeholder={field.placeholder}
                      required={field.required}
                      onValueChange={(value) => updateFieldValue(field.name, value)}
                    />
                  ) : fieldType === "file" ? (
                    <Input
                      accept={field.accept}
                      disabled={field.disabled}
                      id={field.name}
                      name={field.name}
                      required={field.required}
                      type="file"
                    />
                  ) : fieldType === "select" ? (
                    <SearchableFormSelect
                      id={field.name}
                      name={field.name}
                      value={String(fieldValues[field.name] ?? "")}
                      label={field.label}
                      placeholder={field.placeholder}
                      options={field.options ?? []}
                      required={field.required}
                      disabled={field.disabled}
                      dialogOpen={resolvedOpen}
                      onValueChange={(value) => updateFieldValue(field.name, value)}
                    />
                  ) : fieldType === "password" ? (
                    <ProjectPinInput
                      id={field.name}
                      name={field.name}
                      value={String(fieldValues[field.name] ?? "")}
                      placeholder={field.placeholder}
                      required={field.required}
                      disabled={field.disabled}
                      onValueChange={(value) => updateFieldValue(field.name, value)}
                    />
                  ) : (
                    <Input
                      id={field.name}
                      name={field.name}
                      type={fieldType}
                      value={String(fieldValues[field.name] ?? "")}
                      placeholder={field.placeholder}
                      required={field.required}
                      disabled={field.disabled}
                      readOnly={field.readOnly}
                      inputMode={field.inputMode}
                      onChange={(event) => updateFieldValue(field.name, event.target.value)}
                    />
                  )}
                  {field.helperText ? <p className="text-muted-foreground text-xs">{field.helperText}</p> : null}
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
