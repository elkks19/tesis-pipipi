export type AuditCategory = "access" | "error" | "sync";

export type AuditStatus = "failed" | "pending" | "succeeded" | "warning";
export type AuditSeverity = "error" | "info" | "warning";

export type AuditDetailValue = boolean | number | string | null;

export type AuditEvent = {
  type: "audit_event";
  category: AuditCategory;
  action: string;
  actorEmail?: string;
  actorId?: string;
  component: string;
  createdAt: string;
  details?: Record<string, AuditDetailValue>;
  environment: "cloud" | "raspberry";
  errorCode?: string;
  message: string;
  nodeId: string;
  severity: AuditSeverity;
  status: AuditStatus;
};
