import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

interface InteractiveGridProps extends SVGProps<SVGSVGElement> {
  width?: number;
  height?: number;
  squares?: [number, number];
  squaresClassName?: string;
}

export function InteractiveGrid({
  width = 40,
  height = 40,
  squares = [24, 24],
  className,
  squaresClassName,
  ...props
}: InteractiveGridProps) {
  const [horizontal, vertical] = squares;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={width * horizontal}
      height={height * vertical}
      className={cn("absolute inset-0 h-full w-full border border-border/30", className)}
      {...props}
    >
      {Array.from({ length: horizontal * vertical }).map((_, index) => {
        const x = (index % horizontal) * width;
        const y = Math.floor(index / horizontal) * height;

        return (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={width}
            height={height}
            className={cn(
              "stroke-sidebar-foreground/20 transition-all duration-100 ease-in-out [&:not(:hover)]:duration-1000",
              "fill-transparent hover:fill-sidebar-foreground/10",
              squaresClassName,
            )}
          />
        );
      })}
    </svg>
  );
}
