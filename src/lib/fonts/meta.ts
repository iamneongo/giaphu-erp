export const FONT_DEFINITIONS = [
  { key: "arimo", label: "Arimo", variable: "--font-arimo" },
  { key: "beVietnamPro", label: "Be Vietnam Pro", variable: "--font-be-vietnam-pro" },
  { key: "manrope", label: "Manrope", variable: "--font-manrope" },
  { key: "geist", label: "Geist", variable: "--font-geist-sans" },
  { key: "inter", label: "Inter", variable: "--font-inter" },
  { key: "notoSans", label: "Noto Sans", variable: "--font-noto-sans" },
  { key: "nunitoSans", label: "Nunito Sans", variable: "--font-nunito-sans" },
  { key: "figtree", label: "Figtree", variable: "--font-figtree" },
  { key: "roboto", label: "Roboto", variable: "--font-roboto" },
  { key: "raleway", label: "Raleway", variable: "--font-raleway" },
  { key: "dmSans", label: "DM Sans", variable: "--font-dm-sans" },
  { key: "publicSans", label: "Public Sans", variable: "--font-public-sans" },
  { key: "outfit", label: "Outfit", variable: "--font-outfit" },
  { key: "geistMono", label: "Geist Mono", variable: "--font-geist-mono" },
  { key: "geistPixelSquare", label: "Geist Pixel Square", variable: "--font-geist-pixel-square" },
  { key: "jetBrainsMono", label: "JetBrains Mono", variable: "--font-jetbrains-mono" },
  { key: "notoSerif", label: "Noto Serif", variable: "--font-noto-serif" },
  { key: "robotoSlab", label: "Roboto Slab", variable: "--font-roboto-slab" },
  { key: "merriweather", label: "Merriweather", variable: "--font-merriweather" },
  { key: "lora", label: "Lora", variable: "--font-lora" },
  { key: "playfairDisplay", label: "Playfair Display", variable: "--font-playfair-display" },
] as const;

export type FontKey = (typeof FONT_DEFINITIONS)[number]["key"];

export const FONT_KEYS = FONT_DEFINITIONS.map((font) => font.key) as FontKey[];

export const fontOptions = FONT_DEFINITIONS.map(({ key, label, variable }) => ({
  key,
  label,
  variable,
}));
