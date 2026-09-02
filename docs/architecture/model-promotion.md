# NeuroMove Architecture — Model Promotion & Regression Guards

## 1. Multi-Stage Candidate Validation
Before any candidate model can be considered for promotion, it undergoes synchronous held-out evaluation alongside the active incumbent model on identical protected validation trials:

```mermaid
sequenceDiagram
    autonumber
    participant Op as Research Operator
    participant Eng as Adaptation Engine
    participant Pol as Policy Engine
    participant Reg as Version Registry
    participant DB as SQLite Storage

    Op->>Eng: Execute Adaptation (Base v1, Batch Alpha, Policy)
    Eng->>Eng: Partition train & val (train ∩ val = ∅)
    Eng->>Eng: Fit Candidate (CSP + LDA)
    Eng->>Eng: Evaluate Incumbent & Candidate on Protected Val
    Eng->>Pol: Check Promotion Compliance Criteria
    Pol-->>Eng: Return PromotionEligibility (is_eligible, failure_reasons)
    Eng->>DB: Persist AdaptationRun & Candidate Model Artifact (.joblib)
    Eng-->>Op: Return CandidateComparison & Eligibility

    alt Policy Satisfied & Operator Approves
        Op->>Reg: Promote Candidate (adaptation_id, notes)
        Reg->>Reg: Mark Candidate as v2 (ACTIVE_RESEARCH, is_active=True)
        Reg->>Reg: Mark Incumbent v1 as VALIDATED (is_active=False)
        Reg->>DB: Log PromotionDecision Audit Record
        Reg-->>Op: Model Promoted Successfully
    else Operator Rejects
        Op->>Reg: Reject Candidate (adaptation_id, reason)
        Reg->>Reg: Mark Candidate as REJECTED
        Reg->>DB: Log PromotionDecision Audit Record (REJECTED)
        Reg-->>Op: Candidate Rejected; Incumbent Remains Active
    end
```

---

## 2. Deterministic Policy Checklist
Promotion requires passing 5 criteria evaluated by `AdaptationPolicyEngine`:

1. **Zero Data Leakage**: $\text{train\_data} \cap \text{val\_data} = \emptyset$ (Strictly 0 overlap).
2. **Validation Sample Sufficiency**: Total held-out validation trials $\ge \text{min\_validation\_samples}$ (e.g. $\ge 6$).
3. **Class Coverage**: At least 2 distinct target classes represented in held-out validation.
4. **Minimum Absolute Balanced Accuracy**: $\text{BalAcc}_{\text{Candidate}} \ge \text{min\_promoted\_balanced\_accuracy}$ (e.g. $\ge 60\%$).
5. **Regression Guard**:
   $$\text{Regression} = \max(0, \text{BalAcc}_{\text{Incumbent}} - \text{BalAcc}_{\text{Candidate}}) \le \text{MaxAllowedRegression}$$

---

## 3. Comparative Error Migration Analysis
NeuroMove partitions errors into three categories to illuminate whether a candidate is genuinely repairing decision boundaries:
- **Fixed Errors ($+$)**: Trials incorrectly classified by incumbent but correctly resolved by candidate.
- **New Errors ($-$)**: Trials correctly classified by incumbent that candidate now misclassifies.
- **Persistent Errors**: Trials misclassified by both models.
