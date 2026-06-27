import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlanningSkillGaps } from '@/hooks/usePlanningSkillGaps';

describe('usePlanningSkillGaps', () => {
  it('calcula huecos de habilidades seleccionadas', () => {
    const { result } = renderHook(() =>
      usePlanningSkillGaps(
        [{ schedule: { id: 's-1', title: 'Turno' }, reasons: ['skill'] }],
        [
          { skills: [{ id: 'skill-a', name: 'Skill A', category: null, color: '#111' }] },
          { skills: [{ id: 'skill-b', name: 'Skill B', category: null, color: '#222' }] },
        ],
        ['skill-a', 'skill-b'],
      ),
    );

    expect(result.current).toEqual([
      { skillId: 'skill-a', skillName: 'Skill A', availableCount: 1, totalNeeded: 1 },
      { skillId: 'skill-b', skillName: 'Skill B', availableCount: 1, totalNeeded: 1 },
    ]);
  });
});
