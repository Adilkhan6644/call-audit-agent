import io

import pytest

from app.core.exceptions import AppError
from app.services.stt.deepgram_provider import DeepgramSttProvider, _group_words_by_speaker
from app.services.stt.factory import get_stt_provider
from app.services.stt.faster_whisper_provider import FasterWhisperSttProvider
from app.services.stt.openai_whisper_provider import OpenAiWhisperSttProvider


def test_factory_returns_requested_provider_explicitly():
    assert isinstance(get_stt_provider("faster_whisper"), FasterWhisperSttProvider)
    assert isinstance(get_stt_provider("openai_whisper"), OpenAiWhisperSttProvider)
    assert isinstance(get_stt_provider("deepgram"), DeepgramSttProvider)


def test_factory_rejects_unknown_provider():
    with pytest.raises(AppError):
        get_stt_provider("not-a-real-provider")


def test_group_words_by_speaker_collapses_contiguous_turns():
    words = [
        {"speaker": 0, "punctuated_word": "Hello,", "start": 0.0, "end": 0.3},
        {"speaker": 0, "punctuated_word": "there.", "start": 0.3, "end": 0.6},
        {"speaker": 1, "punctuated_word": "Hi!", "start": 0.6, "end": 0.9},
    ]

    segments = _group_words_by_speaker(words)

    assert len(segments) == 2
    assert segments[0].speaker == "Speaker 1"
    assert segments[0].text == "Hello, there."
    assert segments[1].speaker == "Speaker 2"
    assert segments[1].text == "Hi!"


def test_deepgram_provider_parses_response_into_segments(monkeypatch, tmp_path):
    audio_file = tmp_path / "call.mp3"
    audio_file.write_bytes(b"fake audio bytes")

    class _FakeResponse:
        status_code = 200

        def json(self):
            return {
                "metadata": {"duration": 1.2},
                "results": {
                    "channels": [
                        {
                            "detected_language": "en",
                            "alternatives": [
                                {
                                    "transcript": "Hello, there. Hi!",
                                    "words": [
                                        {"speaker": 0, "punctuated_word": "Hello,", "start": 0.0, "end": 0.3},
                                        {"speaker": 1, "punctuated_word": "Hi!", "start": 0.6, "end": 0.9},
                                    ],
                                }
                            ],
                        }
                    ]
                },
            }

    monkeypatch.setattr(
        "app.services.stt.deepgram_provider.httpx.post", lambda *a, **k: _FakeResponse()
    )

    result = DeepgramSttProvider(api_key="test-key").transcribe(str(audio_file))

    assert result.text == "Hello, there. Hi!"
    assert [s.speaker for s in result.segments] == ["Speaker 1", "Speaker 2"]


def test_deepgram_provider_raises_app_error_on_failure(monkeypatch, tmp_path):
    audio_file = tmp_path / "call.mp3"
    audio_file.write_bytes(b"fake audio bytes")

    class _FakeResponse:
        status_code = 401

    monkeypatch.setattr(
        "app.services.stt.deepgram_provider.httpx.post", lambda *a, **k: _FakeResponse()
    )

    with pytest.raises(AppError):
        DeepgramSttProvider(api_key="bad-key").transcribe(str(audio_file))
