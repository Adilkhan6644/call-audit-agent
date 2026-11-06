import mimetypes
from pathlib import Path

import httpx

from app.core.exceptions import AppError
from app.services.stt.base import TranscriptResult, TranscriptSegment


def _group_words_by_speaker(words: list[dict]) -> list[TranscriptSegment]:
    """Collapse Deepgram's per-word speaker tags into contiguous speaker turns."""
    segments: list[TranscriptSegment] = []
    for word in words:
        speaker_label = f"Speaker {word['speaker'] + 1}"
        if segments and segments[-1].speaker == speaker_label:
            segments[-1].text += f" {word['punctuated_word']}"
            segments[-1].end = word["end"]
        else:
            segments.append(
                TranscriptSegment(
                    speaker=speaker_label,
                    text=word["punctuated_word"],
                    start=word["start"],
                    end=word["end"],
                )
            )
    return segments


class DeepgramSttProvider:
    """Transcription + real speaker diarization via the Deepgram REST API."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def transcribe(self, file_path: str) -> TranscriptResult:
        content_type = mimetypes.guess_type(file_path)[0] or "audio/mpeg"
        body = Path(file_path).read_bytes()

        response = httpx.post(
            "https://api.deepgram.com/v1/listen",
            params={"diarize": "true", "punctuate": "true", "model": "nova-2"},
            headers={"Authorization": f"Token {self._api_key}", "Content-Type": content_type},
            content=body,
            timeout=120,
        )
        if response.status_code >= 400:
            raise AppError("Deepgram transcription failed", status_code=502)

        data = response.json()
        alternative = data["results"]["channels"][0]["alternatives"][0]
        words = alternative.get("words", [])

        return TranscriptResult(
            text=alternative["transcript"],
            language=data["results"].get("channels", [{}])[0].get("detected_language", "en"),
            duration_seconds=data["metadata"]["duration"],
            segments=_group_words_by_speaker(words),
        )
