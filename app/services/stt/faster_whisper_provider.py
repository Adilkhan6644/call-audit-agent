from app.services.stt.base import TranscriptResult, TranscriptSegment

# ponytail: no diarization here (faster-whisper doesn't do speaker separation on
# its own; that needs pyannote + a HF token). Everything is reported as one
# speaker until that's worth adding. Use DeepgramSttProvider for real diarization.
_SINGLE_SPEAKER = "Speaker 1"


class FasterWhisperSttProvider:
    """Local transcription via faster-whisper (CTranslate2-optimized Whisper)."""

    def __init__(self, model_size: str = "base") -> None:
        self._model_size = model_size
        self._model = None

    def _get_model(self):
        if self._model is None:
            from faster_whisper import WhisperModel

            self._model = WhisperModel(self._model_size, device="cpu", compute_type="int8")
        return self._model

    def transcribe(self, file_path: str) -> TranscriptResult:
        model = self._get_model()
        segments_iter, info = model.transcribe(file_path)
        segments = []
        full_text_parts = []
        for segment in segments_iter:
            text = segment.text.strip()
            full_text_parts.append(text)
            segments.append(
                TranscriptSegment(speaker=_SINGLE_SPEAKER, text=text, start=segment.start, end=segment.end)
            )

        return TranscriptResult(
            text=" ".join(full_text_parts),
            language=info.language,
            duration_seconds=info.duration,
            segments=segments,
        )
