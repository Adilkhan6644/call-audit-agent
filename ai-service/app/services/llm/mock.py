from app.services.llm.base import StructuredAuditResult


class MockLlmProvider:
    """Deterministic stand-in for a real LLM provider until one is wired in."""

    def audit(self, transcript: str, instructions: str) -> StructuredAuditResult:
        length = len(transcript) if isinstance(transcript, str) else 0
        return StructuredAuditResult(
            summary=f"[mock audit summary, {length} transcript chars]",
            score=1.0,
            findings=[],
        )
