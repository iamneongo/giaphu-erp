"use client";

import * as React from "react";

import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseDateValue(value: string | number | boolean | undefined) {
  if (typeof value !== "string" || !value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DatePickerField({
  name,
  value,
  placeholder,
  required,
  className,
  onValueChange,
}: {
  name: string;
  value?: string | number | boolean;
  placeholder?: string;
  required?: boolean;
  className?: string;
  onValueChange?: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(() => parseDateValue(value));

  React.useEffect(() => {
    setSelectedDate(parseDateValue(value));
  }, [value]);

  return (
    <>
      <Input type="hidden" id={name} name={name} value={selectedDate ? formatDateValue(selectedDate) : ""} readOnly />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-required={required}
            className={cn(
              "w-full justify-between text-left font-normal",
              !selectedDate && "text-muted-foreground",
              className,
            )}
          >
            {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: vi }) : (placeholder ?? "Chọn ngày")}
            <CalendarIcon className="size-4 opacity-70" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            locale={vi}
            captionLayout="dropdown"
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              onValueChange?.(date ? formatDateValue(date) : "");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
