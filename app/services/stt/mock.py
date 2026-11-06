from app.services.stt.base import TranscriptResult


class MockSttProvider:
    """Deterministic stand-in for a real STT provider until one is wired in."""

    def transcribe(self, file_path: str) -> TranscriptResult:
        return TranscriptResult(
            text=f"[mock transcript for {file_path}]",
            language="en",
            duration_seconds=0.0,
        )
