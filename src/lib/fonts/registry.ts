import { Arimo } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare } from "geist/font/pixel";
import { GeistSans } from "geist/font/sans";

const arimo = Arimo({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-arimo",
});

export const fontVars = [arimo.variable, GeistSans.variable, GeistMono.variable, GeistPixelSquare.variable].join(
  " ",
);
