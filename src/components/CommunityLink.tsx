import { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { COMMUNITY_NAME, communityPath } from '../utils/communityRoutes';
import { useNavigation } from '../context/NavigationContext';

/** A community is a navigable, copyable address; ordinary topic tags remain filters. */
export function CommunityLink({ name, children, onSelectTag, ...props }: { name?: string; children: ReactNode; onSelectTag: (tag: string) => void; className?: string; id?: string; title?: string; style?: CSSProperties }) {
  const clean = (name || '').trim().toLowerCase();
  const { openCommunity } = useNavigation();
  return COMMUNITY_NAME.test(clean)
    ? <Link {...props} to={communityPath(clean)} onClick={event => {
      event.stopPropagation();
      if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        openCommunity(clean);
      }
    }}>{children}</Link>
    : <button {...props} type="button" onClick={event => { event.stopPropagation(); if (name) onSelectTag(name); }}>{children}</button>;
}
