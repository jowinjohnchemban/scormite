/**
 * Joins the settings feature (profile data) with the runtime feature
 * (validator implementations). Neither feature may import the other, so the
 * id → implementation resolution lives in app, which may import both.
 */

import { getRuntimeValidator, type RuntimeValidator } from '@/features/runtime'
import type { RuntimeProfile } from '@/features/settings'

/**
 * Resolve a profile's validator rule ids to the live validator
 * implementations. Unknown ids are skipped — a profile referencing a rule
 * that doesn't exist degrades to fewer rules, never a crash.
 */
export function validatorsForProfile(profile: RuntimeProfile): RuntimeValidator[] {
  const validators: RuntimeValidator[] = []
  for (const ruleId of profile.validatorRuleIds) {
    const validator = getRuntimeValidator(ruleId)
    if (validator !== undefined) validators.push(validator)
  }
  return validators
}
