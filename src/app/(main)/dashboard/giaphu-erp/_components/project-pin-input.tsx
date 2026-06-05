"use client";

import * as React from "react";

import { OTPInputContext } from "input-otp";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

const PROJECT_PIN_MAX_LENGTH = 6;
const PROJECT_PIN_SLOT_INDEXES = Array.from({ length: PROJECT_PIN_MAX_LENGTH }, (_, index) => `pin-slot-${index}`);

function ProjectPinSlot({ index, reveal }: { index: number; reveal: boolean }) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <div
      data-active={isActive}
      className={cn(
        "relative flex size-10 items-center justify-center border-input border-y border-r bg-background font-medium text-sm outline-none transition-all first:rounded-l-lg first:border-l last:rounded-r-lg",
        "data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-3 data-[active=true]:ring-ring/50",
      )}
    >
      {char ? (reveal ? char : "•") : null}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}

export function ProjectPinInput({
  id,
  name,
  value,
  placeholder,
  disabled,
  required,
  onValueChange,
}: {
  id?: string;
  name: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  onValueChange: (value: string) => void;
}) {
  const [reveal, setReveal] = React.useState(false);

  return (
    <div className="space-y-2">
      <input name={name} type="hidden" value={value} required={required} />
      <div className="flex flex-wrap items-center gap-2">
        <InputOTP
          id={id}
          value={value}
          onChange={onValueChange}
          maxLength={PROJECT_PIN_MAX_LENGTH}
          disabled={disabled}
          inputMode="numeric"
          containerClassName="gap-0"
          aria-label={placeholder ?? "Mã PIN công trình"}
        >
          <InputOTPGroup>
            {PROJECT_PIN_SLOT_INDEXES.map((slotKey, index) => (
              <ProjectPinSlot key={slotKey} index={index} reveal={reveal} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={Boolean(disabled) || value.length === 0}
          aria-label={reveal ? "Ẩn mã PIN" : "Xem mã PIN"}
          onClick={() => setReveal((current) => !current)}
        >
          {reveal ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      {placeholder ? <p className="text-muted-foreground text-xs">{placeholder}</p> : null}
    </div>
  );
}
