export const Colors = {
  background: "#F7F5F0",
  surface: "#FFFFFF",
  primary: "#172B4D",
  secondary: "#64748B",
  accent: "#C96F4A",
  border: "#E8E3DA",
  muted: "#A6A29A",
  success: "#47745B",
  white: "#FFFFFF",
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  xs: 4,
  two: 8,
  sm: 8,
  three: 12,
  md: 16,
  four: 16,
  lg: 24,
  five: 20,
  xl: 32,
  xxl: 48,
} as const;

export const Fonts = {
  mono: "monospace",
} as const;

export type ThemeColor =
  | "text"
  | "textSecondary"
  | "background"
  | "backgroundSelected"
  | "backgroundElement"
  | "link";

export const Radius = {
  sm: 10,
  md: 16,
  lg: 24,
  full: 999,
} as const;
