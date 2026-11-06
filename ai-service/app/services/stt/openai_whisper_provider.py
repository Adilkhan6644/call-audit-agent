from app.services.stt.base import TranscriptResult, TranscriptSegment

# ponytail: same diarization limitation as FasterWhisperSttProvider — see there.
_SINGLE_SPEAKER = "Speaker 1"


class OpenAiWhisperSttProvider:
    """Local transcription via the original openai-whisper package."""

    def __init__(self, model_size: str = "base") -> None:
        self._model_size = model_size
        self._model = None

    def _get_model(self):
        if self._model is None:
            import whisper

            self._model = whisper.load_model(self._model_size)
        return self._model

    def transcribe(self, file_path: str) -> TranscriptResult:
        model = self._get_model()
        result = model.transcribe(file_path)

        segments = [
            TranscriptSegment(
                speaker=_SINGLE_SPEAKER,
                text=segment["text"].strip(),
                start=segment["start"],
                end=segment["end"],
            )
            for segment in result["segments"]
        ]
        duration = segments[-1].end if segments else 0.0

        return TranscriptResult(
            text=result["text"].strip(),
            language=result["language"],
            duration_seconds=duration,
            segments=segments,
        )
