from app.services.stt.base import TranscriptResult
from app.services.stt.mock import MockSttProvider


def test_mock_returns_deterministic_transcript_result():
    provider = MockSttProvider()

    result = provider.transcribe("call.mp3")

    assert isinstance(result, TranscriptResult)
    assert "call.mp3" in result.text
    assert result.language == "en"
    assert provider.transcribe("call.mp3") == result


def test_mock_satisfies_provider_interface_contract():
    result = MockSttProvider().transcribe("any.wav")

    assert isinstance(result.text, str)
    assert isinstance(result.language, str)
    assert isinstance(result.duration_seconds, float)


def test_mock_separates_speakers():
    result = MockSttProvider().transcribe("call.wav")

    assert [s.speaker for s in result.segments] == ["Speaker 1", "Speaker 2"]
