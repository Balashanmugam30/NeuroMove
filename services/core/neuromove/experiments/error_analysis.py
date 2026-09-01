"""Out-of-Fold Error Analysis Engine for Phase 12 AI Model Laboratory."""

from __future__ import annotations

from collections import Counter, defaultdict

import numpy as np

from neuromove.experiments.models import (
    ConfusedClassPair,
    DifficultSession,
    DifficultSubject,
    ErrorAnalysisResult,
    OutOfFoldPredictionRecord,
)


class OutOfFoldErrorAnalyzer:
    """Analyzes out-of-fold predictions to identify difficult subjects, sessions, and confused pairs."""

    @staticmethod
    def analyze(predictions: list[OutOfFoldPredictionRecord]) -> ErrorAnalysisResult:
        if not predictions:
            return ErrorAnalysisResult(
                total_errors=0,
                overall_error_rate=0.0,
                most_confused_pairs=[],
                difficult_subjects=[],
                difficult_sessions=[],
                misclassified_epoch_ids=[],
            )

        total_samples = len(predictions)
        misclassified = [p for p in predictions if not p.is_correct]
        total_errors = len(misclassified)
        overall_error_rate = round(total_errors / total_samples, 4) if total_samples > 0 else 0.0

        # 1. Most confused class pairs
        confusion_pairs_counter: Counter[tuple[str, str]] = Counter()
        for p in misclassified:
            confusion_pairs_counter[(p.true_label, p.predicted_label)] += 1

        confused_pairs = [
            ConfusedClassPair(true_label=pair[0], predicted_label=pair[1], count=cnt)
            for pair, cnt in confusion_pairs_counter.most_common()
        ]

        # 2. Subject error rates & z-score distribution
        subj_total: dict[str, int] = defaultdict(int)
        subj_errors: dict[str, int] = defaultdict(int)
        for p in predictions:
            subj_total[p.subject_id] += 1
            if not p.is_correct:
                subj_errors[p.subject_id] += 1

        subj_rates = {
            s: (subj_errors[s] / subj_total[s]) if subj_total[s] > 0 else 0.0 for s in subj_total
        }

        all_rates = list(subj_rates.values())
        mean_rate = float(np.mean(all_rates)) if all_rates else 0.0
        std_rate = float(np.std(all_rates)) if all_rates else 1e-6
        if std_rate == 0:
            std_rate = 1e-6

        difficult_subjects: list[DifficultSubject] = []
        for subj, rate in subj_rates.items():
            z = (rate - mean_rate) / std_rate
            difficult_subjects.append(
                DifficultSubject(
                    subject_id=subj,
                    error_rate=round(rate, 4),
                    total_samples=subj_total[subj],
                    z_score=round(z, 2),
                )
            )
        difficult_subjects.sort(key=lambda s: s.error_rate, reverse=True)

        # 3. Session-level difficulty
        sess_total: dict[tuple[str, str], int] = defaultdict(int)
        sess_errors: dict[tuple[str, str], int] = defaultdict(int)
        for p in predictions:
            sess_key = (p.subject_id, p.session_id)
            sess_total[sess_key] += 1
            if not p.is_correct:
                sess_errors[sess_key] += 1

        difficult_sessions: list[DifficultSession] = []
        for (subj, sess), count in sess_total.items():
            err_count = sess_errors[(subj, sess)]
            rate = err_count / count if count > 0 else 0.0
            difficult_sessions.append(
                DifficultSession(
                    subject_id=subj,
                    session_id=sess,
                    error_rate=round(rate, 4),
                    total_samples=count,
                )
            )
        difficult_sessions.sort(key=lambda s: s.error_rate, reverse=True)

        misclassified_epoch_ids = [p.epoch_id for p in misclassified]

        return ErrorAnalysisResult(
            total_errors=total_errors,
            overall_error_rate=overall_error_rate,
            most_confused_pairs=confused_pairs,
            difficult_subjects=difficult_subjects,
            difficult_sessions=difficult_sessions,
            misclassified_epoch_ids=misclassified_epoch_ids,
        )
