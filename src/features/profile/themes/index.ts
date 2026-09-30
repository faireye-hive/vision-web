import { journalistTheme } from './journalist';
import { authorTheme } from './author';
import { photographerTheme } from './photographer';
import { techTheme } from './tech';
import { artistTheme } from './artist';
import { animeTheme } from './anime';
import { defaultTheme } from './default';
import { ProfileTheme } from './themeTypes';

export * from './themeTypes';

export const PROFILE_THEMES: ProfileTheme[] = [
  defaultTheme,
  journalistTheme,
  authorTheme,
  photographerTheme,
  techTheme,
  artistTheme,
  animeTheme
];

export function getThemeById(id: string): ProfileTheme {
  return PROFILE_THEMES.find((t) => t.id === id) || defaultTheme;
}
