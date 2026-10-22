/**
 * SCORM 2004 sequencing definitions (IMS Simple Sequencing + ADL extensions)
 * as declared in imsmanifest.xml. Parsed by the manifest feature; turned
 * into scorm-again's sequencing configuration by the runtime feature.
 *
 * Token values (rule conditions, actions, rollup sets) are kept exactly as
 * the manifest spells them — they are the IMS SS vocabulary, which is also
 * what scorm-again uses.
 */

export type ConditionCombination = 'all' | 'any'

export interface SequencingControlsDefinition {
  // imsss:controlMode
  choice?: boolean
  choiceExit?: boolean
  flow?: boolean
  forwardOnly?: boolean
  useCurrentAttemptObjectiveInfo?: boolean
  useCurrentAttemptProgressInfo?: boolean
  // adlseq:constrainedChoiceConsiderations
  preventActivation?: boolean
  constrainChoice?: boolean
  // imsss:rollupRules attributes
  rollupObjectiveSatisfied?: boolean
  rollupProgressCompletion?: boolean
  objectiveMeasureWeight?: number
  // imsss:randomizationControls
  selectionTiming?: 'never' | 'once' | 'onEachNewAttempt'
  selectCount?: number
  randomizationTiming?: 'never' | 'once' | 'onEachNewAttempt'
  reorderChildren?: boolean
  // imsss:deliveryControls
  tracked?: boolean
  completionSetByContent?: boolean
  objectiveSetByContent?: boolean
}

export interface RuleConditionDefinition {
  condition: string
  /** `not` negates; the manifest's `noOp` is the default and omitted. */
  operator?: 'not'
  referencedObjective?: string
  measureThreshold?: number
}

export interface SequencingRuleDefinition {
  action: string
  conditionCombination: ConditionCombination
  conditions: RuleConditionDefinition[]
}

export interface SequencingRulesDefinition {
  preConditionRules: SequencingRuleDefinition[]
  exitConditionRules: SequencingRuleDefinition[]
  postConditionRules: SequencingRuleDefinition[]
}

export interface RollupConditionDefinition {
  condition: string
  operator?: 'not'
}

export interface RollupRuleDefinition {
  action: string
  childActivitySet: 'all' | 'any' | 'none' | 'atLeastCount' | 'atLeastPercent'
  minimumCount?: number
  /** 0–1, as the manifest declares it. */
  minimumPercent?: number
  conditionCombination: ConditionCombination
  conditions: RollupConditionDefinition[]
}

export type RollupConsiderationRequirement = 'always' | 'ifAttempted' | 'ifNotSkipped' | 'ifNotSuspended'

export interface RollupConsiderationsDefinition {
  requiredForSatisfied?: RollupConsiderationRequirement
  requiredForNotSatisfied?: RollupConsiderationRequirement
  requiredForCompleted?: RollupConsiderationRequirement
  requiredForIncomplete?: RollupConsiderationRequirement
  measureSatisfactionIfActive?: boolean
}

/** imsss:mapInfo merged with any adlseq:mapInfo for the same target. */
export interface ObjectiveMapDefinition {
  targetObjectiveID: string
  readSatisfiedStatus?: boolean
  readNormalizedMeasure?: boolean
  writeSatisfiedStatus?: boolean
  writeNormalizedMeasure?: boolean
  readCompletionStatus?: boolean
  writeCompletionStatus?: boolean
  readProgressMeasure?: boolean
  writeProgressMeasure?: boolean
  readRawScore?: boolean
  writeRawScore?: boolean
  readMinScore?: boolean
  writeMinScore?: boolean
  readMaxScore?: boolean
  writeMaxScore?: boolean
}

export interface ObjectiveDefinition {
  objectiveID: string
  satisfiedByMeasure?: boolean
  minNormalizedMeasure?: number
  mapInfo: ObjectiveMapDefinition[]
}

export interface CompletionThresholdDefinition {
  completedByMeasure?: boolean
  minProgressMeasure?: number
  progressWeight?: number
}

/** Everything an `<imsss:sequencing>` element (plus ADL extensions) can declare. */
export interface SequencingDefinition {
  /** `IDRef` to a shared `<imsss:sequencingCollection>` entry. */
  collectionRef?: string
  controls?: SequencingControlsDefinition
  rules?: SequencingRulesDefinition
  rollupRules?: RollupRuleDefinition[]
  rollupConsiderations?: RollupConsiderationsDefinition
  primaryObjective?: ObjectiveDefinition
  objectives?: ObjectiveDefinition[]
  attemptLimit?: number
  attemptAbsoluteDurationLimit?: string
}

/** adlnav:hideLMSUI tokens. */
export type HideLmsUiToken = 'continue' | 'previous' | 'exit' | 'exitAll' | 'abandon' | 'abandonAll' | 'suspendAll'

/**
 * One node of the activity tree: the organization is the root, every item
 * is an activity, leaves are the launchable SCOs / assets.
 */
export interface ActivityDefinition {
  id: string
  title: string
  isVisible: boolean
  sequencing?: SequencingDefinition
  completionThreshold?: CompletionThresholdDefinition
  hideLmsUi?: HideLmsUiToken[]
  children: ActivityDefinition[]
}
