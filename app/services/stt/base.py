from dataclasses import dataclass
from typing import Protocol


@dataclass
class TranscriptResult:
    text: str
    language: str
    duration_seconds: float


class SttProvider(Protocol):
    def transcribe(self, file_path: str) -> TranscriptResult: ...
