import type { AuthRole } from "@/lib/auth-role-values";

export type AgentUsageAction =
  | "artifact_changed"
  | "pdf_generated"
  | "preset_report"
  | "query";

export type AgentUsageStatus = "cancelled" | "failed" | "succeeded";

export type AgentUsageScope = {
  stationKey?: string;
  viajeIds?: string[];
};

export type AgentUsageTool = {
  name: string;
  status: "failed" | "succeeded";
};

export type AgentUsage = {
  type: "agent_usage";
  action: AgentUsageAction;
  actorId: string;
  actorRole: AuthRole;
  artifactCount?: number;
  completedAt: string;
  conversationId?: string;
  createdAt: string;
  durationMs: number;
  environment: "cloud" | "raspberry";
  errorCode?: string;
  intent?: string;
  messageIndex?: number;
  model?: string;
  nodeId: string;
  provider?: string;
  scope?: AgentUsageScope;
  sourceCount?: number;
  status: AgentUsageStatus;
  tools?: AgentUsageTool[];
};
