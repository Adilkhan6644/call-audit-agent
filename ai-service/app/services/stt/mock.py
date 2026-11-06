from app.services.stt.base import TranscriptResult, TranscriptSegment


class MockSttProvider:
    """Deterministic stand-in for a real STT provider until one is wired in."""

    def transcribe(self, file_path: str) -> TranscriptResult:
        segments = [
            TranscriptSegment(speaker="Speaker 1", text="Hello, thanks for calling.", start=0.0, end=2.0),
            TranscriptSegment(speaker="Speaker 2", text="Hi, I have a question.", start=2.0, end=4.0),
        ]
        return TranscriptResult(
            text=f"[mock transcript for {file_path}]",
            language="en",
            duration_seconds=4.0,
            segments=segments,
        )
