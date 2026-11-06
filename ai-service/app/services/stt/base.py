from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class TranscriptSegment:
    speaker: str  # "Speaker 1", "Speaker 2", ...
    text: str
    start: float
    end: float


@dataclass
class TranscriptResult:
    text: str
    language: str
    duration_seconds: float
    segments: list[TranscriptSegment] = field(default_factory=list)


class SttProvider(Protocol):
    def transcribe(self, file_path: str) -> TranscriptResult: ...
