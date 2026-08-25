export type WizardFieldType = "text" | "number" | "money" | "date" | "select" | "boolean" | "textarea";

export type WizardField = {
  key: string;
  label: string;
  type: WizardFieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  hint?: string;
};

export type WizardStep = {
  id: string;
  title: string;
  help: string;
  fields: WizardField[];
};

const FIELD_TYPES = new Set<WizardFieldType>(["text", "number", "money", "date", "select", "boolean", "textarea"]);

function asFieldType(value: unknown): WizardFieldType {
  const type = String(value ?? "text");
  return FIELD_TYPES.has(type as WizardFieldType) ? (type as WizardFieldType) : "text";
}

function asOptions(value: unknown): { value: string; label: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const options = value
    .map((item) => {
      if (typeof item === "string") return { value: item, label: item };
      if (item && typeof item === "object") {
        const record = item as { value?: unknown; label?: unknown };
        const optionValue = String(record.value ?? record.label ?? "");
        if (!optionValue) return null;
        return { value: optionValue, label: String(record.label ?? optionValue) };
      }
      return null;
    })
    .filter((item): item is { value: string; label: string } => Boolean(item));
  return options.length ? options : undefined;
}

function asFields(value: unknown): WizardField[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const key = String(record.key ?? "").trim();
      if (!key) return null;
      return {
        key,
        label: String(record.label ?? key),
        type: asFieldType(record.type),
        options: asOptions(record.options),
        placeholder: record.placeholder ? String(record.placeholder) : undefined,
        required: Boolean(record.required),
        hint: record.hint ? String(record.hint) : record.help ? String(record.help) : undefined,
      };
    })
    .filter((item): item is WizardField => Boolean(item));
}

/** Accepts both wizard `{ fields }` steps and seeded `{ questions }` steps. */
export function parseWizardSteps(stepsJson: string): WizardStep[] {
  let raw: unknown = [];
  try {
    raw = JSON.parse(stepsJson || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((step, index) => {
    const record = step && typeof step === "object" ? (step as Record<string, unknown>) : {};
    const fields = asFields(record.fields ?? record.questions);
    return {
      id: String(record.id ?? `step-${index}`),
      title: String(record.title ?? `Step ${index + 1}`),
      help: String(record.help ?? ""),
      fields,
    };
  });
}
