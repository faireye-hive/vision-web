/**
 * Profile Color Utilities & Theme Helpers
 * Provides luminance calculation, high-contrast auto-adaptation for light/dark mode,
 * curated palettes for both Light and Dark modes, and color picker helpers.
 */

export interface ColorSwatch {
  label: string;
  hex: string;
  isDark?: boolean;
}

/**
 * Calculates whether a given hex color is perceptually dark or light
 * Uses standard ITU-R BT.601 relative luminance formula.
 */
export function isColorDark(hex?: string): boolean {
  if (!hex || hex === 'transparent') return false;
  const cleanHex = hex.replace('#', '').trim();
  let r = 255;
  let g = 255;
  let b = 255;

  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16) || 255;
    g = parseInt(cleanHex[1] + cleanHex[1], 16) || 255;
    b = parseInt(cleanHex[2] + cleanHex[2], 16) || 255;
  } else if (cleanHex.length >= 6) {
    r = parseInt(cleanHex.substring(0, 2), 16) || 255;
    g = parseInt(cleanHex.substring(2, 4), 16) || 255;
    b = parseInt(cleanHex.substring(4, 6), 16) || 255;
  } else {
    return false;
  }

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.55;
}

/**
 * Returns safe contrast text colors based on custom background colors and dark mode state
 */
export function getSmartTextColors(
  customTextColor?: string,
  customSecondaryColor?: string,
  customBgColor?: string,
  isDarkMode = false
): {
  textColor?: string;
  textSecondaryColor?: string;
} {
  // If user explicitly defined text color, always honor it
  if (customTextColor) {
    return {
      textColor: customTextColor,
      textSecondaryColor: customSecondaryColor || `${customTextColor}aa`
    };
  }

  // If container background color is custom, choose high contrast text
  if (customBgColor) {
    const isDarkBg = isColorDark(customBgColor);
    if (isDarkBg) {
      return {
        textColor: '#f8fafc',
        textSecondaryColor: customSecondaryColor || '#94a3b8'
      };
    } else {
      return {
        textColor: '#0f172a',
        textSecondaryColor: customSecondaryColor || '#64748b'
      };
    }
  }

  // Default auto mode: let Tailwind classes handle light/dark mode
  return {
    textColor: undefined,
    textSecondaryColor: customSecondaryColor || undefined
  };
}

/**
 * Curated Brand Accent Palettes
 */
export const ACCENT_PALETTE: ColorSwatch[] = [
  { label: 'Hive Red', hex: '#e31337' },
  { label: 'Cyber Blue', hex: '#2563eb' },
  { label: 'Emerald Teal', hex: '#059669' },
  { label: 'Electric Violet', hex: '#7c3aed' },
  { label: 'Solar Amber', hex: '#d97706' },
  { label: 'Neon Magenta', hex: '#db2777' },
  { label: 'Cyan Glow', hex: '#0891b2' },
  { label: 'Mint Sage', hex: '#10b981' },
  { label: 'Flame Orange', hex: '#ea580c' },
  { label: 'Sleek Slate', hex: '#475569' }
];

/**
 * Container & Card Background Palettes - Curated for Light & Dark Mode
 */
export const CONTAINER_LIGHT_PALETTE: ColorSwatch[] = [
  { label: 'Pure White', hex: '#ffffff', isDark: false },
  { label: 'Snow Slate', hex: '#f8fafc', isDark: false },
  { label: 'Soft Pearl', hex: '#f1f5f9', isDark: false },
  { label: 'Warm Linen', hex: '#faf8f5', isDark: false },
  { label: 'Soft Ivory', hex: '#fefce8', isDark: false },
  { label: 'Cool Mist', hex: '#f0fdf4', isDark: false },
  { label: 'Ice Blue', hex: '#f0f9ff', isDark: false }
];

export const CONTAINER_DARK_PALETTE: ColorSwatch[] = [
  { label: 'Obsidian Night', hex: '#030712', isDark: true },
  { label: 'Midnight Slate', hex: '#0f172a', isDark: true },
  { label: 'Carbon Deep', hex: '#121212', isDark: true },
  { label: 'Charcoal Zinc', hex: '#18181b', isDark: true },
  { label: 'Dark Navy', hex: '#0b132b', isDark: true },
  { label: 'Cyber Plum', hex: '#170b24', isDark: true },
  { label: 'Deep Forest', hex: '#051b14', isDark: true }
];

/**
 * Solid Page Canvas Background Palettes
 */
export const BACKGROUND_LIGHT_PALETTE: ColorSwatch[] = [
  { label: 'Default Gray', hex: '#f9fafb', isDark: false },
  { label: 'Pure White', hex: '#ffffff', isDark: false },
  { label: 'Soft Slate', hex: '#f1f5f9', isDark: false },
  { label: 'Warm Parchment', hex: '#f7f4ed', isDark: false },
  { label: 'Sky Glaze', hex: '#e0f2fe', isDark: false },
  { label: 'Pale Lilac', hex: '#f5f3ff', isDark: false }
];

export const BACKGROUND_DARK_PALETTE: ColorSwatch[] = [
  { label: 'Pure Black', hex: '#000000', isDark: true },
  { label: 'Void Obsidian', hex: '#020617', isDark: true },
  { label: 'Midnight Slate', hex: '#0f172a', isDark: true },
  { label: 'Onyx Carbon', hex: '#111111', isDark: true },
  { label: 'Deep Zinc', hex: '#18181b', isDark: true },
  { label: 'Dark Space', hex: '#050814', isDark: true }
];

/**
 * Text Color Swatches
 */
export const TEXT_LIGHT_PALETTE: ColorSwatch[] = [
  { label: 'Dark Slate', hex: '#0f172a', isDark: true },
  { label: 'Deep Black', hex: '#000000', isDark: true },
  { label: 'Charcoal Gray', hex: '#334155', isDark: true },
  { label: 'Muted Slate', hex: '#64748b', isDark: false },
  { label: 'Warm Brown', hex: '#451a03', isDark: true }
];

export const TEXT_DARK_PALETTE: ColorSwatch[] = [
  { label: 'Crisp White', hex: '#ffffff', isDark: false },
  { label: 'Bright Slate', hex: '#f8fafc', isDark: false },
  { label: 'Light Silver', hex: '#e2e8f0', isDark: false },
  { label: 'Muted Zinc', hex: '#94a3b8', isDark: false },
  { label: 'Soft Cream', hex: '#fef3c7', isDark: false }
];
