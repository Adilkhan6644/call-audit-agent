from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class StructuredAuditResult:
    summary: str
    score: float
    findings: list[str] = field(default_factory=list)


class LlmProvider(Protocol):
    def audit(self, transcript: str, instructions: str) -> StructuredAuditResult: ...
