import "server-only";
import { db } from "./db";
import { hasFeature, getActivePlan } from "./access";
import { FEATURE_KEYS, STAGE_KEYS } from "./constants";
import { callProvider } from "./ai/adapters";
import { getCaseEvidenceBrief } from "./evidence/brief";
import { loadApprovedViewsByCaseIds } from "./case-presentation";
import { caseListActionLine, caseListEvidenceLine, caseListSummaryFromView, caseListVersionLine } from "./case-presentation-list";
import { matchInputFromCase } from "./goal-versions";
import { authorityQueriesForInquiry, classifyImmigrationInquiry } from "./immigration-inquiry";
import {
  formatGuideSnapshot,
  guideDefaultActionKey,
  guideFallbackCopy,
  guideOpeningCloser,
  guidePrimaryAction,
  guideTipForStep,
  guideUpgradeCopy,
  guideWidgetChrome,
  type GuideChrome,
  type GuideMatchInput,
} from "./goal-guide";
import { resolveIntakeChrome } from "./goal-intake";

// The in-account guide chatbot. It always analyzes the user's account state,
// coaches them through the current matching step (open-options or a filed
// USCIS case), and routes anything it can't help with to the FAQ or the
// ticketing system. It never intakes a new case in chat — it hands off to
// the real case flow with the user's consent.

export type GuideAction = {
  type: "new_case" | "ticket_tech" | "ticket_service" | "link" | "upgrade";
  label: string;
  href: string;
};

export type GuideReply = { message: string; actions: GuideAction[]; chrome: GuideChrome };

type Snapshot = {
  text: string;
  currentStep: { title: string; actionKey: string; caseId: string } | null;
  planName: string;
  surface: GuideMatchInput;
};

function surfaceFromCase(input: {
  id: string;
  situation: string;
  goal: string;
  notices: { noticeType: string }[];
  actionKey?: string | null;
  actionTitle?: string | null;
}): GuideMatchInput {
  const inquiry = classifyImmigrationInquiry({ situation: input.situation, goal: input.goal });
  const noticeTypes = input.notices.map((notice) => notice.noticeType).filter(Boolean);
  return {
    inquiryMode: inquiry.mode,
    themes: inquiry.themes,
    authorityQueries: authorityQueriesForInquiry(inquiry),
    query: `${input.situation} ${input.goal}`.trim(),
    noticeTypes,
    hasNotices: noticeTypes.length > 0,
    caseId: input.id,
    actionKey: input.actionKey ?? null,
    actionTitle: input.actionTitle ?? null,
  };
}

export async function buildAccountSnapshot(userId: string): Promise<Snapshot> {
  const [user, cases, deadlines, plan] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { firstName: true } }),
    db.case.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: {
        pathSteps: { orderBy: { sortOrder: "asc" } },
        notices: { select: { noticeType: true } },
      },
    }),
    db.deadline.findMany({
      where: { userId, status: "open", dueDate: { gte: new Date() } },
      orderBy: { dueDate: "asc" },
      take: 3,
    }),
    getActivePlan(userId),
  ]);

  const views = await loadApprovedViewsByCaseIds(cases.map((c) => c.id));
  const lines: string[] = [`User first name: ${user?.firstName || "there"}`, `Plan: ${plan?.name ?? "Free"}`];
  let currentStep: Snapshot["currentStep"] = null;
  const surfaces = new Map<string, GuideMatchInput>();
  for (const c of cases) {
    const view = views.get(c.id) ?? null;
    const presentation = view?.presentation ?? null;
    const summary = caseListSummaryFromView(
      {
        status: c.status,
        actionReadinessScore: c.actionReadinessScore,
      },
      view,
      matchInputFromCase(c),
    );
    const version = caseListVersionLine(summary);
    const readyAction = presentation?.hero.next_best_action;
    if (!currentStep && readyAction) {
      currentStep = { title: readyAction.title, actionKey: readyAction.action_key, caseId: c.id };
    }
    if (!currentStep) {
      const current = c.pathSteps.find((s) => s.status === "current");
      if (current) currentStep = { title: current.title, actionKey: current.actionKey, caseId: c.id };
    }
    const surface = surfaceFromCase({
      id: c.id,
      situation: c.situation,
      goal: c.goal,
      notices: c.notices,
      actionKey: currentStep?.caseId === c.id ? currentStep.actionKey : readyAction?.action_key ?? c.pathSteps.find((s) => s.status === "current")?.actionKey,
      actionTitle: currentStep?.caseId === c.id ? currentStep.title : readyAction?.title ?? c.pathSteps.find((s) => s.status === "current")?.title,
    });
    surfaces.set(c.id, surface);
    lines.push(
      `Case "${c.title.slice(0, 60)}": approved posture ${summary.posture}; inquiry ${surface.inquiryMode}; ${caseListActionLine(summary)}; ${caseListEvidenceLine(summary)}${version ? `; ${version}` : ""}`,
    );
  }
  const primary = (currentStep && cases.find((c) => c.id === currentStep.caseId)) || cases[0] || null;
  let surface: GuideMatchInput = primary
    ? surfaces.get(primary.id) ?? surfaceFromCase({
        id: primary.id,
        situation: primary.situation,
        goal: primary.goal,
        notices: primary.notices,
        actionKey: currentStep?.actionKey,
        actionTitle: currentStep?.title,
      })
    : {};
  if (currentStep) {
    surface = { ...surface, caseId: currentStep.caseId, actionKey: currentStep.actionKey, actionTitle: currentStep.title };
  }
  if (primary) {
    lines.push(...formatGuideSnapshot(surface));
    if (primary.situation) lines.push(`Current situation: ${primary.situation.slice(0, 220)}`);
    if (primary.goal) lines.push(`Current goal: ${primary.goal.slice(0, 160)}`);
  }
  if (currentStep) {
    const brief = await getCaseEvidenceBrief(currentStep.caseId).catch(() => null);
    const currentPresentation = views.get(currentStep.caseId)?.presentation ?? null;
    if (brief && !currentPresentation) {
      lines.push(`Current evidence position: ${brief.currentPosition}`);
      lines.push(`Evidence status: ${brief.status}`);
      if (brief.pendingActions.length) lines.push(`Evidence-derived actions: ${brief.pendingActions.slice(0, 3).join(" | ")}`);
      if (brief.unknowns.length) lines.push(`Evidence still needs: ${brief.unknowns.slice(0, 3).map((u) => u.question).join(" | ")}`);
    }
  }
  if (cases.length === 0) lines.push("No cases yet — the user hasn't started a case.");
  for (const d of deadlines) {
    lines.push(`Deadline: "${d.title}" due ${d.dueDate.toLocaleDateString("en-US")}`);
  }
  return { text: lines.join("\n"), currentStep, planName: plan?.name ?? "Free", surface };
}

function detectIntent(question: string): "new_case" | "tech" | "service" | null {
  const q = question.toLowerCase();
  if (/(new (case|situation|problem|issue)|another (case|situation|matter|problem|letter)|also got|just received|different (case|situation|matter)|open a case|start a case)/.test(q)) return "new_case";
  if (/(bug|error|broken|crash|can'?t (log|sign) ?in|password|upload(ing)? (fail|isn|not)|page (won'?t|not) load|payment failed|charge[d]? twice|site .*(slow|down)|glitch)/.test(q)) return "tech";
  if (/(case update me|cancel (my )?subscription|billing (problem|issue)|complain|speak (to|with) (someone|human|agent|person)|customer service|talk to a human)/.test(q)) return "service";
  return null;
}

function baseActions(): GuideAction[] {
  return [
    { type: "link", label: "Browse the FAQ", href: "/p/faq" },
    { type: "ticket_service", label: "Create a support ticket", href: "/app/support/new?category=customer_service" },
  ];
}

function withChrome(snapshot: Snapshot, reply: Omit<GuideReply, "chrome">): GuideReply {
  return { ...reply, chrome: guideWidgetChrome(snapshot.surface) };
}

function primaryActions(snapshot: Snapshot): GuideAction[] {
  return [{ ...guidePrimaryAction(snapshot.surface) }, ...baseActions()];
}

export async function guideRespond(
  userId: string,
  history: { role: string; content: string }[],
): Promise<GuideReply> {
  const snapshot = await buildAccountSnapshot(userId);
  const lastQuestion = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  // Paid-feature gate: free accounts get a friendly upsell instead of coaching.
  if (!(await hasFeature(userId, FEATURE_KEYS.GUIDE_CHATBOT))) {
    return withChrome(snapshot, {
      message: guideUpgradeCopy(snapshot.planName),
      actions: [
        { type: "upgrade", label: "See plans & upgrade", href: "/app/billing" },
        { type: "link", label: "Browse the FAQ", href: "/p/faq" },
      ],
    });
  }

  // Opening message (no user question yet): proactive account analysis.
  if (!lastQuestion) {
    const tip = guideTipForStep(guideDefaultActionKey(snapshot.surface), {
      ...snapshot.surface,
      actionKey: guideDefaultActionKey(snapshot.surface),
    })
      ?? (snapshot.surface.caseId
        ? resolveIntakeChrome(snapshot.surface).guideOpenStep
        : resolveIntakeChrome(snapshot.surface).guideNoCaseYet);
    return withChrome(snapshot, {
      message: `Here's where you stand:\n\n${snapshot.text
        .split("\n")
        .filter((l) => l.startsWith("Case") || l.startsWith("Deadline") || l.startsWith("No cases") || l.startsWith("Situation:") || l.startsWith("Matching "))
        .join("\n")}\n\nNext up: ${tip}\n\n${guideOpeningCloser(snapshot.surface)}`,
      actions: primaryActions(snapshot),
    });
  }

  // Hard routing rules the AI must not override.
  const intent = detectIntent(lastQuestion);
  if (intent === "new_case") {
    const intake = resolveIntakeChrome(snapshot.surface);
    return withChrome(snapshot, {
      message: intake.guideNewCaseMessage,
      actions: [
        { type: "new_case", label: intake.guideNewCaseLabel, href: `/app/cases/new?prefill=${encodeURIComponent(lastQuestion.slice(0, 500))}` },
        ...baseActions(),
      ],
    });
  }
  if (intent === "tech") {
    return withChrome(snapshot, {
      message:
        "That sounds like a technical issue — I'll route you to our tech support team so it gets fixed properly. I've prepared a tech support ticket with your description; just review and submit it, and the team will follow up.",
      actions: [
        { type: "ticket_tech", label: "Create tech support ticket", href: `/app/support/new?category=tech_support&subject=${encodeURIComponent(lastQuestion.slice(0, 120))}` },
        { type: "link", label: "Browse the FAQ", href: "/p/faq" },
      ],
    });
  }
  if (intent === "service") {
    return withChrome(snapshot, {
      message:
        "I want to make sure a human takes care of this for you. Let's create a customer service ticket — an agent will pick it up and follow up with you directly. Your message will be pre-filled.",
      actions: [
        { type: "ticket_service", label: "Create customer service ticket", href: `/app/support/new?category=customer_service&subject=${encodeURIComponent(lastQuestion.slice(0, 120))}` },
        { type: "link", label: "Browse the FAQ", href: "/p/faq" },
      ],
    });
  }

  // AI coaching: run each configured model in order. Later providers see prior
  // drafts and produce a refined final answer, so the guide benefits from all
  // available models while still falling back deterministically when needed.
  const stage = await db.pipelineStage.findUnique({
    where: { key: STAGE_KEYS.GUIDE },
    include: {
      steps: { where: { isEnabled: true }, orderBy: { sortOrder: "asc" }, include: { provider: true } },
    },
  });
  const steps = (stage?.isEnabled ? stage.steps : []).filter((s) => s.provider.isEnabled && s.provider.apiKey);
  const convo = history.map((m) => `${m.role === "user" ? "User" : "Guide"}: ${m.content}`).join("\n");
  const drafts: string[] = [];
  for (const step of steps) {
    try {
      const priorDrafts = drafts.length
        ? `\n\nPRIOR GUIDE DRAFTS TO IMPROVE (do not mention them; return one final reply under 150 words):\n${drafts.map((draft, i) => `[Draft ${i + 1}]\n${draft}`).join("\n\n")}`
        : "";
      const prompt = step.promptTemplate.replace("{{context}}", snapshot.text).replace("{{input}}", `${convo}${priorDrafts}`);
      const result = await callProvider(step.provider, [{ role: "user", content: prompt }]);
      if (result.text.trim()) {
        drafts.push(result.text.trim());
      }
    } catch (err) {
      const { logSystem } = await import("./syslog");
      await logSystem("error", "guide", `${step.provider.name} failed answering the guide chat`, String(err), userId);
      // fall through to the next configured model
    }
  }
  if (drafts.length > 0) return withChrome(snapshot, { message: drafts[drafts.length - 1], actions: primaryActions(snapshot) });

  return withChrome(snapshot, {
    message: guideFallbackCopy(snapshot.surface, lastQuestion),
    actions: primaryActions(snapshot),
  });
}
