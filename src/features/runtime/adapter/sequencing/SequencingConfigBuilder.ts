/**
 * Turns the manifest's activity tree (IMS Simple Sequencing as parsed by the
 * manifest feature) into scorm-again's `sequencing` configuration.
 *
 * Every token is checked against what scorm-again implements. Anything it
 * cannot represent faithfully is left out and reported as a warning instead
 * of being silently approximated — a tester must know when the runtime is
 * not evaluating a rule the package declares.
 */

import type { Settings } from 'scorm-again'
import type {
  ActivityDefinition,
  ObjectiveDefinition,
  RollupRuleDefinition,
  SequencingDefinition,
  SequencingRuleDefinition,
} from '@/shared/types'

export type SequencingSettings = NonNullable<Settings['sequencing']>
type ActivitySettings = NonNullable<SequencingSettings['activityTree']>
type CollectionSettings = NonNullable<SequencingSettings['collections']>[string]
type RulesSettings = NonNullable<ActivitySettings['sequencingRules']>
type RuleSettings = NonNullable<RulesSettings['preConditionRules']>[number]
type RuleConditionSettings = RuleSettings['conditions'][number]
type RollupRulesSettings = NonNullable<ActivitySettings['rollupRules']>
type RollupRuleSettings = RollupRulesSettings['rules'][number]
type ControlsSettings = NonNullable<ActivitySettings['sequencingControls']>
type ObjectiveSettings = NonNullable<ActivitySettings['primaryObjective']>

const RULE_CONDITIONS = new Set([
  'satisfied',
  'objectiveStatusKnown',
  'objectiveMeasureKnown',
  'objectiveMeasureGreaterThan',
  'objectiveMeasureLessThan',
  'completed',
  'activityProgressKnown',
  'attempted',
  'attemptLimitExceeded',
  'timeLimitExceeded',
  'outsideAvailableTimeRange',
  'always',
])
const RULE_ACTIONS: Record<keyof RulesSettings, ReadonlySet<string>> = {
  preConditionRules: new Set(['skip', 'disabled', 'hiddenFromChoice', 'stopForwardTraversal']),
  exitConditionRules: new Set(['exit']),
  postConditionRules: new Set(['exitParent', 'exitAll', 'retry', 'retryAll', 'continue', 'previous']),
}
/** IMS rollup condition token → scorm-again's name for it. */
const ROLLUP_CONDITIONS: Readonly<Record<string, string>> = {
  satisfied: 'satisfied',
  objectiveStatusKnown: 'objectiveStatusKnown',
  objectiveMeasureKnown: 'objectiveMeasureKnown',
  completed: 'completed',
  activityProgressKnown: 'progressKnown',
  attempted: 'attempted',
}
const ROLLUP_ACTIONS = new Set(['satisfied', 'notSatisfied', 'completed', 'incomplete'])

export interface BuiltSequencing {
  settings: SequencingSettings
  /** Declared sequencing the runtime will not evaluate, in plain words. */
  warnings: string[]
}

export class SequencingConfigBuilder {
  private warnings: string[] = []

  build(
    tree: ActivityDefinition,
    collections: Record<string, SequencingDefinition> | undefined,
  ): BuiltSequencing {
    this.warnings = []
    const activityTree = this.activity(tree)
    const settings: SequencingSettings = { activityTree }
    if (collections && Object.keys(collections).length > 0) {
      const built: Record<string, CollectionSettings> = {}
      for (const [id, definition] of Object.entries(collections)) {
        built[id] = this.collection(id, definition)
      }
      settings.collections = built
    }
    return { settings, warnings: this.warnings }
  }

  private warn(message: string): void {
    if (!this.warnings.includes(message)) this.warnings.push(message)
  }

  private activity(def: ActivityDefinition): ActivitySettings {
    const seq = def.sequencing
    const out: ActivitySettings = { id: def.id, title: def.title, isVisible: def.isVisible }
    if (def.children.length > 0) out.children = def.children.map((c) => this.activity(c))
    if (def.hideLmsUi) out.hideLmsUi = [...def.hideLmsUi]
    if (def.completionThreshold) out.completionThreshold = { ...def.completionThreshold }
    if (!seq) return out

    const where = `activity "${def.id}"`
    if (seq.collectionRef) out.sequencingCollectionRefs = seq.collectionRef
    const controls = this.controls(seq)
    if (controls) out.sequencingControls = controls
    const delivery = seq.controls
    if (
      delivery?.tracked !== undefined ||
      delivery?.completionSetByContent !== undefined ||
      delivery?.objectiveSetByContent !== undefined
    ) {
      out.deliveryControls = {
        ...(delivery.tracked !== undefined ? { tracked: delivery.tracked } : {}),
        ...(delivery.completionSetByContent !== undefined ? { completionSetByContent: delivery.completionSetByContent } : {}),
        ...(delivery.objectiveSetByContent !== undefined ? { objectiveSetByContent: delivery.objectiveSetByContent } : {}),
      }
    }
    const rules = this.rules(seq, where)
    if (rules) out.sequencingRules = rules
    const rollup = this.rollupRules(seq.rollupRules, where)
    if (rollup) out.rollupRules = rollup
    if (seq.rollupConsiderations) out.rollupConsiderations = { ...seq.rollupConsiderations }
    if (seq.primaryObjective) out.primaryObjective = this.objective(seq.primaryObjective, true, def.id)
    if (seq.objectives) out.objectives = seq.objectives.map((o) => this.objective(o, false, def.id))
    if (seq.attemptLimit !== undefined) out.attemptLimit = seq.attemptLimit
    if (seq.attemptAbsoluteDurationLimit !== undefined) {
      out.attemptAbsoluteDurationLimit = seq.attemptAbsoluteDurationLimit
    }
    return out
  }

  private collection(id: string, def: SequencingDefinition): CollectionSettings {
    const where = `sequencing collection "${id}"`
    if (def.primaryObjective || def.objectives || def.attemptLimit !== undefined || def.attemptAbsoluteDurationLimit !== undefined) {
      this.warn(`${where}: objectives and limit conditions in a shared collection are not applied.`)
    }
    const out: CollectionSettings = {}
    const controls = this.controls(def)
    if (controls) out.sequencingControls = controls
    const rules = this.rules(def, where)
    if (rules) out.sequencingRules = rules
    const rollup = this.rollupRules(def.rollupRules, where)
    if (rollup) out.rollupRules = rollup
    if (def.rollupConsiderations) out.rollupConsiderations = { ...def.rollupConsiderations }
    return out
  }

  private controls(seq: SequencingDefinition): ControlsSettings | undefined {
    const c = seq.controls
    if (!c) return undefined
    const out: Record<string, unknown> = {}
    const keys = [
      'choice', 'choiceExit', 'flow', 'forwardOnly', 'useCurrentAttemptObjectiveInfo',
      'useCurrentAttemptProgressInfo', 'preventActivation', 'constrainChoice',
      'rollupObjectiveSatisfied', 'rollupProgressCompletion', 'objectiveMeasureWeight',
      'selectCount', 'reorderChildren', 'selectionTiming', 'randomizationTiming',
    ] as const
    for (const key of keys) {
      if (c[key] !== undefined) out[key] = c[key]
    }
    // reorderChildren is IMS's name for scorm-again's randomizeChildren.
    if (c.reorderChildren !== undefined) out['randomizeChildren'] = c.reorderChildren
    return Object.keys(out).length > 0 ? (out as ControlsSettings) : undefined
  }

  private rules(seq: SequencingDefinition, where: string): RulesSettings | undefined {
    if (!seq.rules) return undefined
    const out: RulesSettings = {}
    for (const kind of ['preConditionRules', 'exitConditionRules', 'postConditionRules'] as const) {
      const built = seq.rules[kind]
        .map((rule) => this.rule(rule, kind, where))
        .filter((rule): rule is RuleSettings => rule !== null)
      if (built.length > 0) out[kind] = built
    }
    return Object.keys(out).length > 0 ? out : undefined
  }

  private rule(rule: SequencingRuleDefinition, kind: keyof RulesSettings, where: string): RuleSettings | null {
    if (!RULE_ACTIONS[kind].has(rule.action)) {
      this.warn(`${where}: rule action "${rule.action}" is not valid here and was ignored.`)
      return null
    }
    const conditions: RuleConditionSettings[] = []
    for (const condition of rule.conditions) {
      if (!RULE_CONDITIONS.has(condition.condition)) {
        this.warn(`${where}: rule condition "${condition.condition}" is not supported; its rule was ignored.`)
        return null
      }
      conditions.push({
        condition: condition.condition as RuleConditionSettings['condition'],
        ...(condition.operator === 'not' ? { operator: 'not' as NonNullable<RuleConditionSettings['operator']> } : {}),
        ...(condition.referencedObjective ? { referencedObjective: condition.referencedObjective } : {}),
        ...(condition.measureThreshold !== undefined ? { parameters: { threshold: condition.measureThreshold } } : {}),
      })
    }
    if (conditions.length === 0) return null
    return {
      action: rule.action as RuleSettings['action'],
      conditionCombination: rule.conditionCombination as NonNullable<RuleSettings['conditionCombination']>,
      conditions,
    }
  }

  private rollupRules(rules: RollupRuleDefinition[] | undefined, where: string): RollupRulesSettings | undefined {
    if (!rules || rules.length === 0) return undefined
    const built = rules
      .map((rule) => this.rollupRule(rule, where))
      .filter((rule): rule is RollupRuleSettings => rule !== null)
    return built.length > 0 ? { rules: built } : undefined
  }

  private rollupRule(rule: RollupRuleDefinition, where: string): RollupRuleSettings | null {
    if (!ROLLUP_ACTIONS.has(rule.action)) {
      this.warn(`${where}: rollup action "${rule.action}" is not supported; the rule was ignored.`)
      return null
    }
    // scorm-again requires every condition of a rollup rule to hold (and has
    // no "not"), so an "any" combination or a negated condition cannot be
    // expressed without changing the rule's meaning.
    if (rule.conditions.some((c) => c.operator === 'not')) {
      this.warn(`${where}: rollup rules with a "not" condition are not supported by the runtime; the rule was ignored.`)
      return null
    }
    if (rule.conditions.length > 1 && rule.conditionCombination === 'any') {
      this.warn(`${where}: rollup rules combining several conditions with "any" are not supported by the runtime; the rule was ignored.`)
      return null
    }
    const conditions: RollupRuleSettings['conditions'] = []
    for (const condition of rule.conditions) {
      const mapped = ROLLUP_CONDITIONS[condition.condition]
      if (!mapped) {
        this.warn(`${where}: rollup condition "${condition.condition}" is not supported; the rule was ignored.`)
        return null
      }
      conditions.push({ condition: mapped as RollupRuleSettings['conditions'][number]['condition'] })
    }
    return {
      action: rule.action as RollupRuleSettings['action'],
      consideration: rule.childActivitySet as NonNullable<RollupRuleSettings['consideration']>,
      ...(rule.minimumCount !== undefined ? { minimumCount: rule.minimumCount } : {}),
      // IMS declares the percentage as 0–1; scorm-again counts 0–100.
      ...(rule.minimumPercent !== undefined ? { minimumPercent: rule.minimumPercent * 100 } : {}),
      conditions,
    }
  }

  private objective(def: ObjectiveDefinition, isPrimary: boolean, activityId: string): ObjectiveSettings {
    return {
      // A primary objective may omit its ID; scorm-again keys objectives by ID.
      objectiveID: def.objectiveID || `${activityId}#primary`,
      isPrimary,
      ...(def.satisfiedByMeasure !== undefined ? { satisfiedByMeasure: def.satisfiedByMeasure } : {}),
      ...(def.minNormalizedMeasure !== undefined ? { minNormalizedMeasure: def.minNormalizedMeasure } : {}),
      ...(def.mapInfo.length > 0 ? { mapInfo: def.mapInfo.map((m) => ({ ...m })) } : {}),
    }
  }
}
