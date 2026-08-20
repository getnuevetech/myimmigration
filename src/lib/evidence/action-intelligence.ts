import { isImmigrationActionKey, type ImmigrationActionKey } from "@/domain/actions";
import type { EvidenceGateBrief } from "./gate";

export type EvidenceActionState = {
  actionKey: ImmigrationActionKey;
  satisfied: boolean;
  reason: string;
  supportingFacts: string[];
};

function hasFact(brief: EvidenceGateBrief, key: string): boolean {
  return brief.facts.some((fact) => fact.key === key && fact.value);
}

function factValue(brief: EvidenceGateBrief, key: string): string | undefined {
  return brief.facts.find((fact) => fact.key === key && fact.value)?.value;
}

function hasEvent(brief: EvidenceGateBrief, eventTypes: string[]): boolean {
  return brief.events.some((event) => eventTypes.includes(event.eventType));
}

function state(actionKey: ImmigrationActionKey, satisfied: boolean, reason: string, supportingFacts: string[] = []): EvidenceActionState {
  return { actionKey, satisfied, reason, supportingFacts };
}

export function evaluateEvidenceAction(actionKey: string, brief: EvidenceGateBrief): EvidenceActionState | null {
  const normalized = actionKey.toUpperCase();
  if (!isImmigrationActionKey(normalized)) return null;
  const key = normalized as ImmigrationActionKey;

  switch (key) {
    case "UPLOAD_DOCUMENTS":
      return state(
        key,
        brief.facts.length > 0 || brief.events.length > 0,
        brief.facts.length > 0 || brief.events.length > 0
          ? "Compiled evidence facts or events exist for this case."
          : "No compiled evidence exists yet.",
        ["facts", "events"],
      );
    case "UPLOAD_NOTICE": {
      const noticeType = factValue(brief, "notice_type");
      return state(
        key,
        Boolean(noticeType),
        noticeType ? `Evidence already includes a ${noticeType} notice.` : "No notice type has been extracted yet.",
        noticeType ? ["notice_type"] : [],
      );
    }
    case "GET_CASE_RECORD":
    case "GET_ACCOUNT_RECORD": {
      const hasCoreRecord = hasFact(brief, "receipt_number") && hasFact(brief, "form_type");
      return state(
        key,
        hasCoreRecord,
        hasCoreRecord
          ? "Evidence includes both receipt number and form type, enough to identify the USCIS case record."
          : "Receipt number and form type are both needed to verify the case record.",
        hasCoreRecord ? ["receipt_number", "form_type"] : [],
      );
    }
    case "ADD_DEADLINE": {
      const deadline = factValue(brief, "response_deadline") ?? factValue(brief, "appointment_date");
      return state(
        key,
        Boolean(deadline),
        deadline ? `Evidence already includes deadline or appointment date ${deadline}.` : "No deadline or appointment date has been extracted yet.",
        deadline ? ["response_deadline", "appointment_date"] : [],
      );
    }
    case "PREPARE_APPOINTMENT": {
      const appointment = hasFact(brief, "appointment_date") || hasEvent(brief, ["biometrics_scheduled", "interview_scheduled"]);
      return state(
        key,
        appointment,
        appointment ? "Evidence includes an appointment or interview event." : "No appointment or interview event has been extracted yet.",
        appointment ? ["appointment_date", "case_event"] : [],
      );
    }
    default:
      return state(key, false, "This action still requires its existing product-specific verifier.");
  }
}
