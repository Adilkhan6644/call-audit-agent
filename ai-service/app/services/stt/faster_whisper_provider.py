import gc
import io

from app.services.stt.base import TranscriptResult, TranscriptSegment

# ponytail: no diarization here (faster-whisper doesn't do speaker separation on
# its own; that needs pyannote + a HF token). Everything is reported as one
# speaker until that's worth adding. Use DeepgramSttProvider for real diarization.
_SINGLE_SPEAKER = "Speaker 1"


def _decode_audio(input_file, sampling_rate: int):
    """Mirrors faster_whisper.audio.decode_audio, minus the `metadata_errors`
    kwarg to av.open() — PyAV dropped it in its v14 rewrite, and pinning an
    older av that still has it means compiling from source on Windows
    (requires MSVC build tools) since no prebuilt wheel exists for newer
    Python versions. Reuses faster-whisper's own frame-grouping/resampling
    helpers so behavior otherwise matches exactly."""
    import av
    import numpy as np
    from faster_whisper.audio import _group_frames, _ignore_invalid_frames, _resample_frames

    resampler = av.audio.resampler.AudioResampler(format="s16", layout="mono", rate=sampling_rate)
    raw_buffer = io.BytesIO()
    dtype = None

    with av.open(input_file, mode="r") as container:
        frames = container.decode(audio=0)
        frames = _ignore_invalid_frames(frames)
        frames = _group_frames(frames, 500000)
        frames = _resample_frames(frames, resampler)
        for frame in frames:
            array = frame.to_ndarray()
            dtype = array.dtype
            raw_buffer.write(array)

    del resampler
    gc.collect()

    audio = np.frombuffer(raw_buffer.getbuffer(), dtype=dtype)
    return audio.astype(np.float32) / 32768.0


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
        audio = _decode_audio(file_path, sampling_rate=model.feature_extractor.sampling_rate)
        segments_iter, info = model.transcribe(audio)
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
