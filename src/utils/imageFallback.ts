import type { SyntheticEvent } from 'react';
import avatarPlaceholder from '../assets/avatar-placeholder.svg';

export const AVATAR_PLACEHOLDER = avatarPlaceholder;

/** Use the bundled placeholder after a failed image, without retrying it. */
export function handleImageFallback(
  event: SyntheticEvent<HTMLImageElement>,
  fallbackSrc = AVATAR_PLACEHOLDER
): void {
  const image = event.currentTarget;
  const currentSrc = image.getAttribute('src');
  if (currentSrc === AVATAR_PLACEHOLDER) return;

  // Optional thumbnail-to-avatar fallbacks get one attempt before going local.
  const nextSrc = currentSrc === fallbackSrc ? AVATAR_PLACEHOLDER : fallbackSrc;
  image.removeAttribute('srcset');
  image.src = nextSrc;
}
