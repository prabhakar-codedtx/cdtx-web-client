import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Title } from '@/lib/api/types';
import type { HandoffStep } from '@/player/handoff';

/**
 * Takes a step from `handoffStep`: the player with where to carry on from (`state.handoff`), or the
 * title's page (through `onAction('detail')`, as any other tap on it). True when it did something.
 */
export function useHandoff(onAction?: (action: string, title: Title | null) => void) {
  const navigate = useNavigate();
  return useCallback(
    (title: Title, step: HandoffStep): boolean => {
      if (!step) return false;
      if (step.to === 'detail') {
        onAction?.('detail', title);
        return true;
      }
      navigate(`/play/${title.type ?? 'title'}/${title.id}`, { state: { title, handoff: step.handoff } });
      return true;
    },
    [navigate, onAction],
  );
}
