/**
 * SCORM 2004 sequencing parsed from imsmanifest.xml, and the activity tree
 * built from it.
 */

import { describe, expect, it } from 'vitest'
import { parseManifest } from '../services/ManifestParserService'
import { getActivityTree } from '../services/activityTree'

const MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest identifier="seq" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:ss="http://www.imsglobal.org/xsd/imsss"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3">
  <organizations default="org">
    <organization identifier="org">
      <title>Course</title>
      <item identifier="module" >
        <title>Module</title>
        <item identifier="intro" identifierref="r1">
          <title>Intro</title>
          <ss:sequencing>
            <ss:objectives>
              <ss:primaryObjective objectiveID="intro-done" satisfiedByMeasure="false">
                <ss:mapInfo targetObjectiveID="g-intro" readSatisfiedStatus="false" writeSatisfiedStatus="true"/>
              </ss:primaryObjective>
            </ss:objectives>
            <adlseq:objectives>
              <adlseq:objective objectiveID="intro-done">
                <adlseq:mapInfo targetObjectiveID="g-intro" writeRawScore="true"/>
              </adlseq:objective>
            </adlseq:objectives>
          </ss:sequencing>
          <adlnav:presentation>
            <adlnav:navigationInterface>
              <adlnav:hideLMSUI>continue</adlnav:hideLMSUI>
              <adlnav:hideLMSUI>bogus</adlnav:hideLMSUI>
            </adlnav:navigationInterface>
          </adlnav:presentation>
        </item>
        <item identifier="quiz" identifierref="r1">
          <title>Quiz</title>
          <adlcp:completionThreshold completedByMeasure="true" minProgressMeasure="0.8" progressWeight="2"/>
          <ss:sequencing IDRef="shared">
            <ss:sequencingRules>
              <ss:preConditionRule>
                <ss:ruleConditions conditionCombination="any">
                  <ss:ruleCondition referencedObjective="gate" operator="not" condition="satisfied"/>
                  <ss:ruleCondition condition="objectiveMeasureLessThan" measureThreshold="0.5"/>
                </ss:ruleConditions>
                <ss:ruleAction action="disabled"/>
              </ss:preConditionRule>
              <ss:postConditionRule>
                <ss:ruleConditions><ss:ruleCondition condition="satisfied"/></ss:ruleConditions>
                <ss:ruleAction action="exitAll"/>
              </ss:postConditionRule>
            </ss:sequencingRules>
            <ss:limitConditions attemptLimit="3" attemptAbsoluteDurationLimit="PT1H"/>
            <ss:objectives>
              <ss:primaryObjective objectiveID="quiz-pass" satisfiedByMeasure="true">
                <ss:minNormalizedMeasure>0.7</ss:minNormalizedMeasure>
              </ss:primaryObjective>
              <ss:objective objectiveID="gate">
                <ss:mapInfo targetObjectiveID="g-intro" readSatisfiedStatus="true"/>
              </ss:objective>
            </ss:objectives>
            <ss:deliveryControls tracked="true" completionSetByContent="true" objectiveSetByContent="true"/>
          </ss:sequencing>
        </item>
      </item>
      <item identifier="empty"><title>Nothing here</title></item>
      <ss:sequencing>
        <ss:controlMode choice="false" flow="true" forwardOnly="true"/>
        <ss:rollupRules rollupObjectiveSatisfied="true" objectiveMeasureWeight="0.5">
          <ss:rollupRule childActivitySet="atLeastPercent" minimumPercent="0.75">
            <ss:rollupConditions>
              <ss:rollupCondition condition="completed"/>
            </ss:rollupConditions>
            <ss:rollupAction action="completed"/>
          </ss:rollupRule>
        </ss:rollupRules>
        <adlseq:rollupConsiderations requiredForSatisfied="ifAttempted" measureSatisfactionIfActive="false"/>
        <adlseq:constrainedChoiceConsiderations constrainChoice="true"/>
        <ss:randomizationControls selectionTiming="once" selectCount="2" randomizationTiming="bogus"/>
      </ss:sequencing>
    </organization>
  </organizations>
  <resources>
    <resource identifier="r1" type="webcontent" adlcp:scormType="sco" href="index.html"/>
  </resources>
  <ss:sequencingCollection>
    <ss:sequencing ID="shared">
      <ss:controlMode choiceExit="false"/>
    </ss:sequencing>
  </ss:sequencingCollection>
</manifest>`

describe('SequencingParser via parseManifest', () => {
  const manifest = parseManifest(MANIFEST)
  const org = manifest.organizations[0]
  const module = org?.items[0]
  const intro = module?.children[0]
  const quiz = module?.children[1]

  it('parses organization controls, rollup, considerations, and randomization', () => {
    expect(org?.sequencing).toEqual({
      controls: {
        choice: false,
        flow: true,
        forwardOnly: true,
        constrainChoice: true,
        rollupObjectiveSatisfied: true,
        objectiveMeasureWeight: 0.5,
        selectionTiming: 'once',
        selectCount: 2,
      },
      rollupRules: [
        {
          action: 'completed',
          childActivitySet: 'atLeastPercent',
          minimumPercent: 0.75,
          conditionCombination: 'any',
          conditions: [{ condition: 'completed' }],
        },
      ],
      rollupConsiderations: { requiredForSatisfied: 'ifAttempted', measureSatisfactionIfActive: false },
    })
  })

  it('parses rules, limits, objectives, delivery controls, and a collection ref', () => {
    expect(quiz?.sequencing).toEqual({
      collectionRef: 'shared',
      controls: { tracked: true, completionSetByContent: true, objectiveSetByContent: true },
      rules: {
        preConditionRules: [
          {
            action: 'disabled',
            conditionCombination: 'any',
            conditions: [
              { condition: 'satisfied', operator: 'not', referencedObjective: 'gate' },
              { condition: 'objectiveMeasureLessThan', measureThreshold: 0.5 },
            ],
          },
        ],
        exitConditionRules: [],
        postConditionRules: [
          { action: 'exitAll', conditionCombination: 'all', conditions: [{ condition: 'satisfied' }] },
        ],
      },
      primaryObjective: { objectiveID: 'quiz-pass', satisfiedByMeasure: true, minNormalizedMeasure: 0.7, mapInfo: [] },
      objectives: [
        { objectiveID: 'gate', mapInfo: [{ targetObjectiveID: 'g-intro', readSatisfiedStatus: true }] },
      ],
      attemptLimit: 3,
      attemptAbsoluteDurationLimit: 'PT1H',
    })
  })

  it('merges adlseq extended mapInfo into the matching objective', () => {
    expect(intro?.sequencing?.primaryObjective).toEqual({
      objectiveID: 'intro-done',
      satisfiedByMeasure: false,
      mapInfo: [
        {
          targetObjectiveID: 'g-intro',
          readSatisfiedStatus: false,
          writeSatisfiedStatus: true,
          writeRawScore: true,
        },
      ],
    })
  })

  it('parses structured completion thresholds and valid hideLMSUI tokens only', () => {
    expect(quiz?.completionThreshold).toEqual({ completedByMeasure: true, minProgressMeasure: 0.8, progressWeight: 2 })
    expect(intro?.hideLmsUi).toEqual(['continue'])
  })

  it('parses sequencing collections by ID', () => {
    expect(manifest.sequencingCollections).toEqual({ shared: { controls: { choiceExit: false } } })
  })

  it('leaves SCORM 1.2-style items without sequencing fields', () => {
    expect(org?.items[1]).toEqual({ identifier: 'empty', title: 'Nothing here', isvisible: true, children: [] })
  })
})

describe('getActivityTree', () => {
  it('roots the tree at the default organization and drops empty items', () => {
    const tree = getActivityTree(parseManifest(MANIFEST))
    expect(tree?.id).toBe('org')
    expect(tree?.sequencing?.controls?.flow).toBe(true)
    expect(tree?.children.map((c) => c.id)).toEqual(['module'])
    expect(tree?.children[0]?.children.map((c) => c.id)).toEqual(['intro', 'quiz'])
    expect(tree?.children[0]?.children[1]?.completionThreshold?.minProgressMeasure).toBe(0.8)
  })

  it('returns null without organizations', () => {
    expect(getActivityTree({ organizations: [], resources: [], metadata: {} })).toBeNull()
  })
})
