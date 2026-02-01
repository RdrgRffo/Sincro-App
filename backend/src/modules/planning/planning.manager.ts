import type {
  AvailabilityItem,
  AvailabilityMatrix,
  CrisisModeSummary,
  CoverageRiskItem,
  EquityItem,
  PlanningActor,
  PlanningRangeFilters,
  ScopedPlanningRangeFilters,
  SubstituteSuggestion,
  TemplatePreviewDay,
  TimelineItem,
  AbsenceImpact,
} from './planning.types';
import type {
  NotificationPreferencesInput,
  PlanningCommentInput,
  AbsenceImpactQueryInput,
} from './planning.validation';
import { planningManagerCore } from './planning.manager.core';
import { PlanningCoverageManager } from './planning.manager.coverage';
import { PlanningAvailabilityManager } from './planning.manager.availability';
import { PlanningEquityManager } from './planning.manager.equity';
import { PlanningSupportManager } from './planning.manager.support';
import { PlanningPreferencesManager } from './planning.manager.preferences';
import { isSameDay } from 'date-fns';

/**
 * Facade over planning sub-managers. Preserves the public API used by PlanningService and tests.
 */
export class PlanningManager {
  private readonly core = planningManagerCore;
  private readonly coverage: PlanningCoverageManager;
  private readonly availability: PlanningAvailabilityManager;
  private readonly equity: PlanningEquityManager;
  private readonly support: PlanningSupportManager;
  private readonly preferences: PlanningPreferencesManager;

  constructor() {
    this.coverage = new PlanningCoverageManager(this.core);
    this.availability = new PlanningAvailabilityManager(this.core);
    this.equity = new PlanningEquityManager(this.core);
    this.support = new PlanningSupportManager(this.core);
    this.preferences = new PlanningPreferencesManager();
  }

  async resolveScopedFilters(
    filters: PlanningRangeFilters,
    actor: PlanningActor,
  ): Promise<ScopedPlanningRangeFilters> {
    return this.core.resolveScopedFilters(filters, actor);
  }

  async listUsersInScope(filters: ScopedPlanningRangeFilters) {
    return this.core.listUsersInScope(filters);
  }

  async countUsersInScope(filters: ScopedPlanningRangeFilters): Promise<number> {
    return this.core.countUsersInScope(filters);
  }

  async listCoverageRisks(
    filters: ScopedPlanningRangeFilters,
    actor: PlanningActor,
  ): Promise<CoverageRiskItem[]> {
    return this.coverage.listCoverageRisks(filters, actor);
  }

  async listAvailability(
    filters: ScopedPlanningRangeFilters,
    actor: PlanningActor,
  ): Promise<AvailabilityItem[]> {
    return this.availability.listAvailability(filters, actor);
  }

  async getAvailabilityMatrix(
    filters: ScopedPlanningRangeFilters,
    actor: PlanningActor,
  ): Promise<AvailabilityMatrix> {
    return this.availability.getAvailabilityMatrix(filters, actor);
  }

  async listSubstituteSuggestions(
    filters: ScopedPlanningRangeFilters & { skillIds?: string[] },
    actor: PlanningActor,
  ): Promise<SubstituteSuggestion[]> {
    return this.availability.listSubstituteSuggestions(filters, actor);
  }

  async listEquity(filters: ScopedPlanningRangeFilters): Promise<EquityItem[]> {
    return this.equity.listEquity(filters);
  }

  async listTimeline(filters: ScopedPlanningRangeFilters): Promise<TimelineItem[]> {
    return this.equity.listTimeline(filters);
  }

  async getAbsenceImpact(filters: AbsenceImpactQueryInput, actor: PlanningActor): Promise<AbsenceImpact> {
    return this.coverage.getAbsenceImpact(filters, actor);
  }

  async getCrisisSummary(filters: ScopedPlanningRangeFilters, actor: PlanningActor): Promise<CrisisModeSummary> {
    const today = new Date();
    const [risks, equity, timeline] = await Promise.all([
      this.coverage.listCoverageRisks(filters, actor),
      this.equity.listEquity(filters),
      this.equity.listTimeline(filters),
    ]);

    return {
      highRisks: risks.filter((risk) => risk.severity === 'high'),
      mediumRisks: risks.filter((risk) => risk.severity === 'medium'),
      overloaded: equity
        .filter((item) => item.overtimeEstimate > 0 || item.weekendShifts > 1 || item.urgentShifts > 1)
        .slice(0, 8),
      today: timeline
        .filter((item) => isSameDay(new Date(item.at), today) && (item.severity === 'high' || item.severity === 'medium'))
        .slice(0, 10),
    };
  }

  async getTemplatePreview(
    filters: ScopedPlanningRangeFilters & { skillIds?: string[]; minCoverage: number },
    actor: PlanningActor,
  ): Promise<TemplatePreviewDay[]> {
    return this.availability.getTemplatePreview(filters, actor);
  }

  async listComments(entityType: string, entityId: string) {
    return this.support.listComments(entityType, entityId);
  }

  async addComment(input: PlanningCommentInput, actor: PlanningActor) {
    return this.support.addComment(input, actor);
  }

  async getNotificationPreferences(actor: PlanningActor) {
    return this.preferences.getNotificationPreferences(actor);
  }

  async updateNotificationPreferences(actor: PlanningActor, data: NotificationPreferencesInput) {
    return this.preferences.updateNotificationPreferences(actor, data);
  }
}

export const planningManager = new PlanningManager();
