import { useCallback, useEffect, useState } from 'react';
import { COMMUNITY_FEATURES_CHANGED, CommunityFeatures, loadCommunityFeatures } from '../services/communityFeatures';

export function useCommunityFeatures(name: string) {
  const [state, setState] = useState<{ name: string; data: CommunityFeatures | null; loading: boolean; error: string }>({ name, data: null, loading: !!name, error: '' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setState({ name, data: null, loading: !!name, error: '' });
    if (name) loadCommunityFeatures(name).then(data => {
      if (active) setState({ name, data, loading: false, error: '' });
    }).catch(error => {
      if (active) setState({ name, data: null, loading: false, error: error.message });
    });
    const onChange = (event: Event) => {
      if ((event as CustomEvent).detail === name) retry();
    };
    window.addEventListener(COMMUNITY_FEATURES_CHANGED, onChange);
    return () => { active = false; window.removeEventListener(COMMUNITY_FEATURES_CHANGED, onChange); };
  }, [name, attempt, retry]);
  return { ...(state.name === name ? state : { data: null, loading: !!name, error: '' }), retry };
}
