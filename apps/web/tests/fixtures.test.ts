import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  SystemStatusSchema,
  EventEnvelopeSchema,
  PredictionPayloadSchema,
  IntentConfirmedPayloadSchema,
  SafetyDecisionPayloadSchema,
  RobotStatePayloadSchema,
  SessionSchema,
  TrialSchema,
} from "@neuromove/contracts";

const FIXTURES_DIR = path.resolve(
  __dirname,
  "../../../tests/fixtures/contracts",
);

describe("Cross-Language Canonical JSON Fixtures", () => {
  it("parses system-status.json fixture correctly", () => {
    const raw = fs.readFileSync(
      path.join(FIXTURES_DIR, "system-status.json"),
      "utf-8",
    );
    const json = JSON.parse(raw);
    const parsed = SystemStatusSchema.parse(json);
    expect(parsed.service).toBe("neuromove-core");
    expect(parsed.mode).toBe("SIMULATION");
    expect(parsed.components.api).toBe("healthy");
    expect(parsed.components.database).toBe("ready");
  });

  it("parses prediction-event.json fixture correctly", () => {
    const raw = fs.readFileSync(
      path.join(FIXTURES_DIR, "prediction-event.json"),
      "utf-8",
    );
    const json = JSON.parse(raw);
    const envelope = EventEnvelopeSchema.parse(json);
    expect(envelope.event_type).toBe("PREDICTION");
    expect(envelope.sequence).toBe(101);

    const payload = PredictionPayloadSchema.parse(envelope.payload);
    expect(payload.intent).toBe("RIGHT");
    expect(payload.neural_confidence).toBe(0.92);
  });

  it("parses intent-confirmed-event.json fixture correctly", () => {
    const raw = fs.readFileSync(
      path.join(FIXTURES_DIR, "intent-confirmed-event.json"),
      "utf-8",
    );
    const json = JSON.parse(raw);
    const envelope = EventEnvelopeSchema.parse(json);
    expect(envelope.event_type).toBe("INTENT_CONFIRMED");

    const payload = IntentConfirmedPayloadSchema.parse(envelope.payload);
    expect(payload.intent).toBe("RIGHT");
    expect(payload.confidence).toBe(0.94);
    expect(payload.consecutive_epochs).toBe(3);
  });

  it("parses safety-approved-event.json fixture correctly", () => {
    const raw = fs.readFileSync(
      path.join(FIXTURES_DIR, "safety-approved-event.json"),
      "utf-8",
    );
    const json = JSON.parse(raw);
    const envelope = EventEnvelopeSchema.parse(json);
    expect(envelope.event_type).toBe("SAFETY_APPROVED");

    const payload = SafetyDecisionPayloadSchema.parse(envelope.payload);
    expect(payload.decision).toBe("APPROVED");
    expect(payload.risk_level).toBe("SAFE");
  });

  it("parses safety-blocked-event.json fixture correctly", () => {
    const raw = fs.readFileSync(
      path.join(FIXTURES_DIR, "safety-blocked-event.json"),
      "utf-8",
    );
    const json = JSON.parse(raw);
    const envelope = EventEnvelopeSchema.parse(json);
    expect(envelope.event_type).toBe("SAFETY_BLOCKED");

    const payload = SafetyDecisionPayloadSchema.parse(envelope.payload);
    expect(payload.decision).toBe("BLOCKED");
    expect(payload.reason_code).toBe("PROXIMITY_OBSTACLE");
  });

  it("parses robot-state-event.json fixture correctly", () => {
    const raw = fs.readFileSync(
      path.join(FIXTURES_DIR, "robot-state-event.json"),
      "utf-8",
    );
    const json = JSON.parse(raw);
    const envelope = EventEnvelopeSchema.parse(json);
    expect(envelope.event_type).toBe("ROBOT_STATE");

    const payload = RobotStatePayloadSchema.parse(envelope.payload);
    expect(payload.motion_state).toBe("MOVING");
    expect(payload.battery).toBe(88.5);
    expect(payload.left_motor).toBe(140);
  });

  it("parses session.json fixture correctly", () => {
    const raw = fs.readFileSync(
      path.join(FIXTURES_DIR, "session.json"),
      "utf-8",
    );
    const json = JSON.parse(raw);
    const session = SessionSchema.parse(json);
    expect(session.session_id).toBe("ses_98f12a4b1234");
    expect(session.status).toBe("ACTIVE");
  });

  it("parses trial.json fixture correctly", () => {
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, "trial.json"), "utf-8");
    const json = JSON.parse(raw);
    const trial = TrialSchema.parse(json);
    expect(trial.trial_id).toBe("trl_01a2b3c4d5e6");
    expect(trial.label).toBe("RIGHT");
    expect(trial.trial_index).toBe(12);
  });
});
