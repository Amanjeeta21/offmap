/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';

export function useTheme() {
  return {
    text: Colors.primary,
    textSecondary: Colors.secondary,
    background: Colors.background,
    backgroundSelected: "#EFEAE1",
    backgroundElement: Colors.surface,
    link: Colors.accent,
  };
}
