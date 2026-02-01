import { planningManager } from './planning.manager';
import type {
  AvailabilityItem,
  AvailabilityMatrix,
  CrisisModeSummary,
  CoverageRiskItem,
  EquityItem,
  PlanningActor,
  PlanningRangeFilters,
  PlanningComment,
  SubstituteSuggestion,
  TemplatePreviewDay,
  TimelineItem,
  AbsenceImpact,
} from './planning.types';
import type {
  NotificationPreferencesInput,
  PlanningCommentInput,
  PlanningCommentsQueryInput,
  PlanningSubstitutesQueryInput,
  PlanningTemplatePreviewQueryInput,
  AbsenceImpactQueryInput,
} from './planning.validation';

export class PlanningService {
  /**
   * Get coverage risks for the planning dashboard.
   */
  async getCoverageRisks(
    filters: PlanningRangeFilters,
    actor: PlanningActor,
  ): Promise<CoverageRiskItem[]> {
    const scopedFilters = await planningManager.resolveScopedFilters(filters, actor);
    return planningManager.listCoverageRisks(scopedFilters, actor);
  }

  /**
   * Get employee availability for the planning dashboard.
   */
  async getAvailability(
    filters: PlanningRangeFilters,
    actor: PlanningActor,
  ): Promise<AvailabilityItem[]> {
    const scopedFilters = await planningManager.resolveScopedFilters(filters, actor);
    return planningManager.listAvailability(scopedFilters, actor);
  }

  /**
   * Get daily employee availability matrix for the planning dashboard.
   */
  async getAvailabilityMatrix(
    filters: PlanningRangeFilters,
    actor: PlanningActor,
  ): Promise<AvailabilityMatrix> {
    const scopedFilters = await planningManager.resolveScopedFilters(filters, actor);
    return planningManager.getAvailabilityMatrix(scopedFilters, actor);
  }

  /**
   * Get ranked substitute suggestions for the requested range.
   */
  async getSubstituteSuggestions(
    filters: PlanningSubstitutesQueryInput,
    actor: PlanningActor,
  ): Promise<SubstituteSuggestion[]> {
    const scopedFilters = await planningManager.resolveScopedFilters(filters, actor);
    return planningManager.listSubstituteSuggestions({ ...scopedFilters, skillIds: filters.skillIds }, actor);
  }

  /**
   * Get fairness metrics for the requested range.
   */
  async getEquity(filters: PlanningRangeFilters, actor: PlanningActor): Promise<EquityItem[]> {
    const scopedFilters = await planningManager.resolveScopedFilters(filters, actor);
    return planningManager.listEquity(scopedFilters);
  }

  /**
   * Get an operational timeline for the requested range.
   */
  async getTimeline(filters: PlanningRangeFilters, actor: PlanningActor): Promise<TimelineItem[]> {
    const scopedFilters = await planningManager.resolveScopedFilters(filters, actor);
    return planningManager.listTimeline(scopedFilters);
  }

  /**
   * Estimate absence approval impact for a user in a date range.
   */
  async getAbsenceImpact(filters: AbsenceImpactQueryInput, actor: PlanningActor): Promise<AbsenceImpact> {
    return planningManager.getAbsenceImpact(filters, actor);
  }

  /**
   * Get a crisis-mode summary for the requested range.
   */
  async getCrisisMode(filters: PlanningRangeFilters, actor: PlanningActor): Promise<CrisisModeSummary> {
    const scopedFilters = await planningManager.resolveScopedFilters(filters, actor);
    return planningManager.getCrisisSummary(scopedFilters, actor);
  }

  /**
   * Preview suggested coverage per day for a template.
   */
  async getTemplatePreview(
    filters: PlanningTemplatePreviewQueryInput,
    actor: PlanningActor,
  ): Promise<TemplatePreviewDay[]> {
    const scopedFilters = await planningManager.resolveScopedFilters(filters, actor);
    return planningManager.getTemplatePreview({
      ...scopedFilters,
      skillIds: filters.skillIds,
      minCoverage: filters.minCoverage,
    }, actor);
  }

  /**
   * List comments for a planning entity.
   */
  async listComments(filters: PlanningCommentsQueryInput): Promise<PlanningComment[]> {
    return planningManager.listComments(filters.entityType, filters.entityId);
  }

  /**
   * Add a comment to a planning entity.
   */
  async addComment(input: PlanningCommentInput, actor: PlanningActor): Promise<PlanningComment> {
    return planningManager.addComment(input, actor);
  }

  /**
   * Read notification preferences for the actor.
   */
  async getNotificationPreferences(actor: PlanningActor) {
    return planningManager.getNotificationPreferences(actor);
  }

  /**
   * Update notification preferences for the actor.
   */
  async updateNotificationPreferences(actor: PlanningActor, input: NotificationPreferencesInput) {
    return planningManager.updateNotificationPreferences(actor, input);
  }
}

export const planningService = new PlanningService();
