import { useMemo } from 'react';
import type { AvailabilityItem, CoverageRiskItem } from '@/hooks/usePlanning';

export type PlanningSkillGap = {
  skillId: string;
  skillName: string;
  availableCount: number;
  totalNeeded: number;
};

export function usePlanningSkillGaps(
  risks: Array<Pick<CoverageRiskItem, 'schedule' | 'reasons'>> | undefined,
  availability: Array<Pick<AvailabilityItem, 'skills'>> | undefined,
  selectedSkillIds: string[],
) {
  return useMemo<PlanningSkillGap[]>(() => {
    if (!selectedSkillIds.length || !availability) return [];

    return selectedSkillIds.map((skillId) => {
      const skill = availability
        .flatMap((user) => user.skills ?? [])
        .find((entry) => entry.id === skillId);
      const availableCount = availability.filter((user) =>
        user.skills?.some((entry) => entry.id === skillId),
      ).length;

      return {
        skillId,
        skillName: skill?.name ?? skillId,
        availableCount,
        totalNeeded: Math.max(1, risks?.length ?? 1),
      };
    });
  }, [risks, availability, selectedSkillIds]);
}
