"""
US-10: lógica de detecção de recalibração do plano.
Regra: 3 últimos feedbacks iguais disparam ajuste.
"""
import pytest
from app.services.feedback import check_recalibration_needed, FeedbackSignal


class TestCheckRecalibration:
    def test_three_hard_triggers_reduce(self):
        result = check_recalibration_needed(["hard", "hard", "hard"])
        assert result == FeedbackSignal.REDUCE

    def test_three_easy_triggers_increase(self):
        result = check_recalibration_needed(["easy", "easy", "easy"])
        assert result == FeedbackSignal.INCREASE

    def test_three_medium_returns_none(self):
        result = check_recalibration_needed(["medium", "medium", "medium"])
        assert result is None

    def test_mixed_feedbacks_returns_none(self):
        result = check_recalibration_needed(["hard", "medium", "hard"])
        assert result is None

    def test_only_last_three_matter_easy(self):
        feedbacks = ["hard", "medium", "easy", "easy", "easy"]
        result = check_recalibration_needed(feedbacks)
        assert result == FeedbackSignal.INCREASE

    def test_only_last_three_matter_hard(self):
        feedbacks = ["easy", "medium", "hard", "hard", "hard"]
        result = check_recalibration_needed(feedbacks)
        assert result == FeedbackSignal.REDUCE

    def test_fewer_than_three_feedbacks_returns_none(self):
        assert check_recalibration_needed([]) is None
        assert check_recalibration_needed(["hard"]) is None
        assert check_recalibration_needed(["hard", "hard"]) is None

    def test_invalid_feedback_value_raises(self):
        with pytest.raises(ValueError):
            check_recalibration_needed(["hard", "hard", "very_hard"])

    def test_exactly_three_feedbacks_hard(self):
        result = check_recalibration_needed(["hard", "hard", "hard"])
        assert result == FeedbackSignal.REDUCE

    def test_four_hard_feedbacks_still_reduces(self):
        result = check_recalibration_needed(["hard", "hard", "hard", "hard"])
        assert result == FeedbackSignal.REDUCE
