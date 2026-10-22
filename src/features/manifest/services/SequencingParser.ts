/**
 * Parses SCORM 2004 sequencing from imsmanifest.xml: `<imsss:sequencing>`
 * (controlMode, sequencingRules, limitConditions, rollupRules, objectives,
 * randomizationControls, deliveryControls), the ADL extensions
 * (`adlseq:constrainedChoiceConsiderations`, `adlseq:rollupConsiderations`,
 * `adlseq:objectives` extended mapInfo, `adlnav:hideLMSUI`), structured
 * `adlcp:completionThreshold`, and `<imsss:sequencingCollection>`.
 *
 * Output is plain data in the IMS vocabulary; evaluating it is the runtime's
 * (scorm-again's) job.
 */

import type {
  CompletionThresholdDefinition,
  ConditionCombination,
  HideLmsUiToken,
  ObjectiveDefinition,
  ObjectiveMapDefinition,
  RollupConditionDefinition,
  RollupConsiderationRequirement,
  RollupConsiderationsDefinition,
  RollupRuleDefinition,
  RuleConditionDefinition,
  SequencingControlsDefinition,
  SequencingDefinition,
  SequencingRuleDefinition,
  SequencingRulesDefinition,
} from '@/shared/types'
import { attr, boolAttr, child, children, isNode, numAttr, text } from './xmlNode'

const HIDE_LMS_UI_TOKENS: ReadonlySet<string> = new Set<HideLmsUiToken>([
  'continue',
  'previous',
  'exit',
  'exitAll',
  'abandon',
  'abandonAll',
  'suspendAll',
])

const CHILD_ACTIVITY_SETS = new Set(['all', 'any', 'none', 'atLeastCount', 'atLeastPercent'])
const TIMINGS = new Set(['never', 'once', 'onEachNewAttempt'])
const REQUIREMENTS = new Set(['always', 'ifAttempted', 'ifNotSkipped', 'ifNotSuspended'])

const MAP_FLAGS = [
  'readSatisfiedStatus',
  'readNormalizedMeasure',
  'writeSatisfiedStatus',
  'writeNormalizedMeasure',
  'readCompletionStatus',
  'writeCompletionStatus',
  'readProgressMeasure',
  'writeProgressMeasure',
  'readRawScore',
  'writeRawScore',
  'readMinScore',
  'writeMinScore',
  'readMaxScore',
  'writeMaxScore',
] as const satisfies readonly (keyof ObjectiveMapDefinition)[]

/** Copies only the defined entries, so optional properties stay absent. */
function defined<T extends object>(entries: { [K in keyof T]?: T[K] | undefined }): T {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) out[key] = value
  }
  return out as T
}

function nonEmpty<T extends object>(value: T): T | undefined {
  return Object.keys(value).length > 0 ? value : undefined
}

function combination(node: unknown): ConditionCombination {
  return attr(node, 'conditionCombination')?.trim() === 'any' ? 'any' : 'all'
}

export class SequencingParser {
  /** The `<imsss:sequencing>` child of an item or organization. */
  parseFor(owner: unknown): SequencingDefinition | undefined {
    const [node] = children(owner, 'sequencing')
    return node === undefined ? undefined : this.parse(node)
  }

  /** `<imsss:sequencingCollection>` entries, keyed by their `ID`. */
  parseCollections(manifest: unknown): Record<string, SequencingDefinition> | undefined {
    const out: Record<string, SequencingDefinition> = {}
    for (const collection of children(manifest, 'sequencingCollection')) {
      for (const node of children(collection, 'sequencing')) {
        const id = attr(node, 'ID')?.trim()
        const parsed = this.parse(node)
        if (id && parsed) out[id] = parsed
      }
    }
    return nonEmpty(out)
  }

  /** `adlnav:presentation/navigationInterface/hideLMSUI` tokens of an item. */
  parseHideLmsUi(item: unknown): HideLmsUiToken[] | undefined {
    const tokens = children(child(child(item, 'presentation'), 'navigationInterface'), 'hideLMSUI')
      .map((value) => text(value)?.trim() ?? '')
      .filter((token): token is HideLmsUiToken => HIDE_LMS_UI_TOKENS.has(token))
    return tokens.length > 0 ? [...new Set(tokens)] : undefined
  }

  /**
   * 4th Edition `completedByMeasure` / `minProgressMeasure` /
   * `progressWeight` attributes, or a 3rd Edition text threshold (which
   * implies completion by measure).
   */
  parseCompletionThreshold(item: unknown): CompletionThresholdDefinition | undefined {
    const node = child(item, 'completionThreshold')
    if (node === undefined) return undefined
    const textValue = Number(text(node)?.trim())
    if (!isNode(node) && Number.isFinite(textValue)) {
      return { completedByMeasure: true, minProgressMeasure: textValue }
    }
    return nonEmpty(
      defined<CompletionThresholdDefinition>({
        completedByMeasure: boolAttr(node, 'completedByMeasure'),
        minProgressMeasure: numAttr(node, 'minProgressMeasure'),
        progressWeight: numAttr(node, 'progressWeight'),
      }),
    )
  }

  parse(node: unknown): SequencingDefinition | undefined {
    const limits = child(node, 'limitConditions')
    const rollup = child(node, 'rollupRules')
    const objectives = this.objectives(node)
    const rules = this.rules(child(node, 'sequencingRules'))
    const rollupRules = children(rollup, 'rollupRule').map((r) => this.rollupRule(r))
    const primary = objectives.find((o) => o.primary)
    const secondary = objectives.filter((o) => !o.primary).map((o) => o.objective)

    return nonEmpty(
      defined<SequencingDefinition>({
        collectionRef: attr(node, 'IDRef')?.trim() || undefined,
        controls: this.controls(node, rollup),
        rules,
        rollupRules: rollupRules.length > 0 ? rollupRules : undefined,
        rollupConsiderations: this.rollupConsiderations(child(node, 'rollupConsiderations')),
        primaryObjective: primary?.objective,
        objectives: secondary.length > 0 ? secondary : undefined,
        attemptLimit: numAttr(limits, 'attemptLimit'),
        attemptAbsoluteDurationLimit: attr(limits, 'attemptAbsoluteDurationLimit')?.trim() || undefined,
      }),
    )
  }

  private controls(node: unknown, rollup: unknown): SequencingControlsDefinition | undefined {
    const mode = child(node, 'controlMode')
    const choice = child(node, 'constrainedChoiceConsiderations')
    const random = child(node, 'randomizationControls')
    const delivery = child(node, 'deliveryControls')
    const selectionTiming = attr(random, 'selectionTiming')
    const randomizationTiming = attr(random, 'randomizationTiming')
    return nonEmpty(
      defined<SequencingControlsDefinition>({
        choice: boolAttr(mode, 'choice'),
        choiceExit: boolAttr(mode, 'choiceExit'),
        flow: boolAttr(mode, 'flow'),
        forwardOnly: boolAttr(mode, 'forwardOnly'),
        useCurrentAttemptObjectiveInfo: boolAttr(mode, 'useCurrentAttemptObjectiveInfo'),
        useCurrentAttemptProgressInfo: boolAttr(mode, 'useCurrentAttemptProgressInfo'),
        preventActivation: boolAttr(choice, 'preventActivation'),
        constrainChoice: boolAttr(choice, 'constrainChoice'),
        rollupObjectiveSatisfied: boolAttr(rollup, 'rollupObjectiveSatisfied'),
        rollupProgressCompletion: boolAttr(rollup, 'rollupProgressCompletion'),
        objectiveMeasureWeight: numAttr(rollup, 'objectiveMeasureWeight'),
        selectionTiming:
          selectionTiming && TIMINGS.has(selectionTiming)
            ? (selectionTiming as SequencingControlsDefinition['selectionTiming'])
            : undefined,
        selectCount: numAttr(random, 'selectCount'),
        randomizationTiming:
          randomizationTiming && TIMINGS.has(randomizationTiming)
            ? (randomizationTiming as SequencingControlsDefinition['randomizationTiming'])
            : undefined,
        reorderChildren: boolAttr(random, 'reorderChildren'),
        tracked: boolAttr(delivery, 'tracked'),
        completionSetByContent: boolAttr(delivery, 'completionSetByContent'),
        objectiveSetByContent: boolAttr(delivery, 'objectiveSetByContent'),
      }),
    )
  }

  private rules(node: unknown): SequencingRulesDefinition | undefined {
    if (node === undefined) return undefined
    const parse = (name: string) => children(node, name).map((rule) => this.rule(rule))
    const rules: SequencingRulesDefinition = {
      preConditionRules: parse('preConditionRule'),
      exitConditionRules: parse('exitConditionRule'),
      postConditionRules: parse('postConditionRule'),
    }
    const count = rules.preConditionRules.length + rules.exitConditionRules.length + rules.postConditionRules.length
    return count > 0 ? rules : undefined
  }

  private rule(node: unknown): SequencingRuleDefinition {
    const conditionsNode = child(node, 'ruleConditions')
    return {
      action: attr(child(node, 'ruleAction'), 'action')?.trim() ?? '',
      conditionCombination: combination(conditionsNode),
      conditions: children(conditionsNode, 'ruleCondition').map((condition) =>
        defined<RuleConditionDefinition>({
          condition: attr(condition, 'condition')?.trim() ?? '',
          operator: attr(condition, 'operator')?.trim() === 'not' ? 'not' : undefined,
          referencedObjective: attr(condition, 'referencedObjective')?.trim() || undefined,
          measureThreshold: numAttr(condition, 'measureThreshold'),
        }),
      ),
    }
  }

  private rollupRule(node: unknown): RollupRuleDefinition {
    const conditionsNode = child(node, 'rollupConditions')
    const set = attr(node, 'childActivitySet')?.trim() ?? 'all'
    return defined<RollupRuleDefinition>({
      action: attr(child(node, 'rollupAction'), 'action')?.trim() ?? '',
      childActivitySet: (CHILD_ACTIVITY_SETS.has(set) ? set : 'all') as RollupRuleDefinition['childActivitySet'],
      minimumCount: numAttr(node, 'minimumCount'),
      minimumPercent: numAttr(node, 'minimumPercent'),
      // IMS SS default for rollup conditions is "any".
      conditionCombination: attr(conditionsNode, 'conditionCombination')?.trim() === 'all' ? 'all' : 'any',
      conditions: children(conditionsNode, 'rollupCondition').map((condition) =>
        defined<RollupConditionDefinition>({
          condition: attr(condition, 'condition')?.trim() ?? '',
          operator: attr(condition, 'operator')?.trim() === 'not' ? 'not' : undefined,
        }),
      ),
    })
  }

  private rollupConsiderations(node: unknown): RollupConsiderationsDefinition | undefined {
    const requirement = (name: string): RollupConsiderationRequirement | undefined => {
      const value = attr(node, name)?.trim()
      return value && REQUIREMENTS.has(value) ? (value as RollupConsiderationRequirement) : undefined
    }
    return nonEmpty(
      defined<RollupConsiderationsDefinition>({
        requiredForSatisfied: requirement('requiredForSatisfied'),
        requiredForNotSatisfied: requirement('requiredForNotSatisfied'),
        requiredForCompleted: requirement('requiredForCompleted'),
        requiredForIncomplete: requirement('requiredForIncomplete'),
        measureSatisfactionIfActive: boolAttr(node, 'measureSatisfactionIfActive'),
      }),
    )
  }

  /**
   * imsss:objectives (primary + secondary) merged with adlseq:objectives,
   * whose extended mapInfo (scores, completion, progress) is keyed by the
   * same objectiveID / targetObjectiveID.
   */
  private objectives(node: unknown): { primary: boolean; objective: ObjectiveDefinition }[] {
    const byId = new Map<string, { primary: boolean; objective: ObjectiveDefinition }>()
    const upsert = (raw: unknown, primary: boolean) => {
      const id = attr(raw, 'objectiveID')?.trim() ?? ''
      // A primary objective may legally omit its ID; secondary ones may not.
      if (!id && !primary) return
      const key = id || '__primary__'
      const entry = byId.get(key) ?? { primary, objective: { objectiveID: id, mapInfo: [] } }
      entry.primary ||= primary
      const satisfiedByMeasure = boolAttr(raw, 'satisfiedByMeasure')
      if (satisfiedByMeasure !== undefined) entry.objective.satisfiedByMeasure = satisfiedByMeasure
      const minMeasure = Number(text(child(raw, 'minNormalizedMeasure'))?.trim())
      if (Number.isFinite(minMeasure) && child(raw, 'minNormalizedMeasure') !== undefined) {
        entry.objective.minNormalizedMeasure = minMeasure
      }
      for (const map of children(raw, 'mapInfo')) this.mergeMap(entry.objective.mapInfo, map)
      byId.set(key, entry)
    }

    for (const group of children(node, 'objectives')) {
      for (const primary of children(group, 'primaryObjective')) upsert(primary, true)
      for (const objective of children(group, 'objective')) upsert(objective, false)
    }
    return [...byId.values()]
  }

  private mergeMap(maps: ObjectiveMapDefinition[], raw: unknown): void {
    const target = attr(raw, 'targetObjectiveID')?.trim()
    if (!target) return
    let map = maps.find((m) => m.targetObjectiveID === target)
    if (!map) {
      map = { targetObjectiveID: target }
      maps.push(map)
    }
    for (const flag of MAP_FLAGS) {
      const value = boolAttr(raw, flag)
      if (value !== undefined) map[flag] = value
    }
  }
}
