/**
 * Zod schemas for runtime validation
 */
import { z } from 'zod';

export const WorkspaceStatusSchema = z.enum(['idle', 'running', 'completed', 'error']);
export const SessionStatusSchema = z.enum(['starting', 'running', 'completed', 'failed']);
export const MessageRoleSchema = z.enum(['user', 'assistant']);
export const ChangeTypeSchema = z.enum(['created', 'modified', 'deleted']);
export const AgentTypeSchema = z.enum(['claude-code', 'codex']);
export const LogLevelSchema = z.enum(['info', 'warning', 'error']);

export const CreateWorkspaceRequestSchema = z.object({
  name: z.string().min(1).max(255),
  path: z.string().min(1),
  agentType: AgentTypeSchema.optional(),
});

export const UpdateWorkspaceRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: WorkspaceStatusSchema.optional(),
  lastFocusedAt: z.number().optional(),
});

export const CreateSessionRequestSchema = z.object({
  agentType: AgentTypeSchema,
  initialPrompt: z.string().optional(),
});

export const SendMessageRequestSchema = z.object({
  content: z.string().min(1),
});

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  status: WorkspaceStatusSchema,
  agentType: AgentTypeSchema.nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastFocusedAt: z.number().nullable(),
});

export const SessionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  agentType: AgentTypeSchema,
  status: SessionStatusSchema,
  processId: z.number().nullable(),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
});

export const MessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  timestamp: z.number(),
});

export const FileChangeSchema = z.object({
  id: z.number(),
  sessionId: z.string(),
  filePath: z.string(),
  changeType: ChangeTypeSchema,
  diff: z.string().nullable(),
  timestamp: z.number(),
});

export const AgentLogSchema = z.object({
  id: z.number(),
  sessionId: z.string(),
  timestamp: z.number(),
  level: LogLevelSchema,
  message: z.string(),
});
