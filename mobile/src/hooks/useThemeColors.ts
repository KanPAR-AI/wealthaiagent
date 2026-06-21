import { useThemeStore } from '../store/theme';
import { getThemeColors } from '../theme';

export function useThemeColors() {
  const isDark = useThemeStore((s) => s.isDark);
  return getThemeColors(isDark);
}
