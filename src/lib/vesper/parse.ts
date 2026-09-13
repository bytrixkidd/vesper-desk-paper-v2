import { spokenName } from "./plain";
import { expandActions, planFromText, type PlanContext } from "./registry";
import type { AnswerStage, TalkTopic, VesperAction } from "./types";

export type ParsedIntent = {
  actions: VesperAction[];
  interpretation: string;
  wantsAi: boolean;
  stop: boolean;
  kind: string;
  topic: TalkTopic;
  stage: AnswerStage;
  opening?: string;
};

export function parseIntent(raw: string, ctx?: { symbol?: string | null; topic?: TalkTopic; stage?: AnswerStage }): ParsedIntent {
  const planCtx: PlanContext = { symbol: ctx?.symbol, topic: ctx?.topic, stage: ctx?.stage };
  const plan = planFromText(raw, planCtx);
  const actions = expandActions(plan.actions);
  const ticker = [...plan.actions, ...actions].find((a) => a.type === "openSecurity" || a.type === "selectTicker");
  const name =
    ticker && (ticker.type === "openSecurity" || ticker.type === "selectTicker") ? spokenName(ticker.symbol) : null;
  let opening = plan.opening;
  if (plan.kind === "openSecurity" && name) opening = `Ich öffne ${name}, Sir.`;
  else if (opening && name) opening = opening.replace(/\b[A-Z]{2,5}\b/, name);
  return {
    actions,
    interpretation: plan.interpretation,
    wantsAi: plan.wantsAi,
    stop: plan.stop,
    kind: plan.kind,
    topic: plan.topic,
    stage: plan.stage,
    opening,
  };
}
