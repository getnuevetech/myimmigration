/**
 * Re-export learning helpers from Experience L0 module.
 * Conversation layer keeps stable import paths.
 */
export {
  buildLearningEvent,
  learningEventFromIntelligence,
  assertNoPrematureSchemaAsk,
  buildExperienceRecord,
  learningEventFromExperience,
} from "@/lib/experience/experience-record";
