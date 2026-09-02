import { z } from "zod";
import {
  ProductSessionStatusEnum,
  DemoStateEnum,
  SystemHealthStatusEnum,
  ProductDemoScenarioEnum,
  ProductStageEnum,
  ProductExecutionOutcomeEnum,
  SensorSourceEnum,
  SafetyDecisionEnum,
} from "./enums";

// ============================================================================
// Phase 24.1: Final Competition Product Foundation Contracts
// ============================================================================

export const SubsystemHealthCardSchema = z.object({
  subsystem_id: z.string(),
  name: z.string(),
  status: SystemHealthStatusEnum.default("HEALTHY"),
  source_type: SensorSourceEnum.default("SIMULATOR"),
  summary: z.string(),
  key_metrics: z.record(z.string(), z.any()).default({}),
  last_updated: z.string().default("2026-01-01T00:00:00Z"),
  is_operational: z.boolean().default(true),
  route_href: z.string().default("/overview"),
});
export type SubsystemHealthCard = z.infer<typeof SubsystemHealthCardSchema>;

export const SystemStatusSummarySchema = z.object({
  overall_status: SystemHealthStatusEnum.default("HEALTHY"),
  product_session_id: z.string().default("prod_sess_default"),
  active_source: SensorSourceEnum.default("SIMULATOR"),
  is_live_streaming: z.boolean().default(false),
  subsystems: z.record(z.string(), SubsystemHealthCardSchema).default({}),
  current_stage: ProductStageEnum.default("SENSORS"),
  safety_armed: z.boolean().default(true),
  hil_ready: z.boolean().default(true),
  last_check_time: z.string().default("2026-01-01T00:00:00Z"),
});
export type SystemStatusSummary = z.infer<typeof SystemStatusSummarySchema>;

export const ProductProvenanceSchema = z.object({
  product_session_id: z.string(),
  acquisition_session_id: z.string().nullable().optional(),
  sensor_session_id: z.string().nullable().optional(),
  experiment_id: z.string().nullable().optional(),
  model_version_id: z.string().default("csp_lda_v2.4"),
  confidence_policy: z.string().default("STRICT_RESEARCH_FUSION"),
  intent_id: z.string().nullable().optional(),
  safety_decision: SafetyDecisionEnum.default("AUTHORIZED"),
  hil_session_id: z.string().nullable().optional(),
  source_checksum: z.string().default(""),
  manifest_hash: z.string().default(""),
  provenance_hash: z.string().default(""),
});
export type ProductProvenance = z.infer<typeof ProductProvenanceSchema>;

export const ProductSessionSchema = z.object({
  session_id: z.string(),
  title: z.string().default("Competition Product Session"),
  subject_id: z.string().default("SUBJ_PILOT_01"),
  source_type: SensorSourceEnum.default("SIMULATOR"),
  status: ProductSessionStatusEnum.default("ACTIVE"),
  acquisition_session_id: z.string().nullable().optional(),
  sensor_session_id: z.string().nullable().optional(),
  model_version: z.string().default("csp_lda_v2.4"),
  confidence_policy: z.string().default("STRICT_RESEARCH_FUSION"),
  intent_id: z.string().nullable().optional(),
  safety_decision: SafetyDecisionEnum.default("AUTHORIZED"),
  hil_session_id: z.string().nullable().optional(),
  experiment_id: z.string().nullable().optional(),
  manifest_hash: z.string().default(""),
  provenance_hash: z.string().default(""),
  created_at: z.string().default("2026-01-01T00:00:00Z"),
  updated_at: z.string().default("2026-01-01T00:00:00Z"),
});
export type ProductSession = z.infer<typeof ProductSessionSchema>;

export const DemoStepSchema = z.object({
  step_index: z.number().int().min(1).max(9),
  step_key: z.string(),
  title: z.string(),
  description: z.string(),
  stage: ProductStageEnum,
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED", "FAILED"]).default("PENDING"),
  metrics: z.record(z.string(), z.any()).default({}),
  explanation: z.string().default(""),
});
export type DemoStep = z.infer<typeof DemoStepSchema>;

export const DemoRunSchema = z.object({
  run_id: z.string(),
  scenario_id: ProductDemoScenarioEnum.default("PRODUCT_A"),
  product_session_id: z.string(),
  state: DemoStateEnum.default("IDLE"),
  current_step: z.number().int().min(1).max(9).default(1),
  total_steps: z.number().int().default(9),
  source_type: SensorSourceEnum.default("SIMULATOR"),
  steps: z.array(DemoStepSchema).default([]),
  candidate_intent: z.string().default("REST"),
  confidence_score: z.number().min(0).max(1).default(0.0),
  safety_verdict: SafetyDecisionEnum.default("AUTHORIZED"),
  hil_ack: z.boolean().default(false),
  is_blocked: z.boolean().default(false),
  block_reason: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  reproducibility_status: z.enum(["PASS", "APPROXIMATE", "FAIL", "NOT_CHECKED"]).default("NOT_CHECKED"),
  duration_ms: z.number().default(0.0),
  created_at: z.string().default("2026-01-01T00:00:00Z"),
  completed_at: z.string().nullable().optional(),
});
export type DemoRun = z.infer<typeof DemoRunSchema>;

export const DemoResultSchema = z.object({
  result_id: z.string(),
  run_id: z.string(),
  scenario_id: ProductDemoScenarioEnum.default("PRODUCT_A"),
  status: ProductExecutionOutcomeEnum.default("PASS"),
  source_type: SensorSourceEnum.default("SIMULATOR"),
  candidate_intent: z.string().default("REST"),
  confidence_score: z.number().min(0).max(1).default(0.0),
  safety_verdict: SafetyDecisionEnum.default("AUTHORIZED"),
  hil_status: z.string().default("ACKNOWLEDGED"),
  latency_breakdown: z.record(z.string(), z.number()).default({}),
  provenance: ProductProvenanceSchema.optional(),
  explanation_text: z.string().default(""),
  created_at: z.string().default("2026-01-01T00:00:00Z"),
});
export type DemoResult = z.infer<typeof DemoResultSchema>;

export const DemoScenarioSchema = z.object({
  id: ProductDemoScenarioEnum,
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  expected_outcome: ProductExecutionOutcomeEnum,
  expected_safety: SafetyDecisionEnum,
  is_deterministic: z.boolean().default(true),
  source: SensorSourceEnum.default("SIMULATOR"),
});
export type DemoScenario = z.infer<typeof DemoScenarioSchema>;
