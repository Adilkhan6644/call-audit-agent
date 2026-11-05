import io
import shutil

import pytest

from app.core import storage
from app.core.config import settings
from app.core.exceptions import AppError


@pytest.fixture(autouse=True)
def _clean_upload_dir():
    yield
    shutil.rmtree(settings.upload_dir, ignore_errors=True)


def test_save_lands_under_upload_dir():
    key = storage.save("call.mp3", io.BytesIO(b"fake audio bytes"))

    path = storage.get_path(key)
    assert path.is_file()
    assert path.parent.resolve() == storage.get_path("x").parent.resolve()
    assert path.read_bytes() == b"fake audio bytes"


def test_save_rejects_disallowed_extension():
    with pytest.raises(AppError):
        storage.save("malware.exe", io.BytesIO(b"data"))


def test_save_generates_uuid_key_not_original_filename():
    key = storage.save("../../etc/passwd.wav", io.BytesIO(b"data"))

    assert "passwd" not in key
    assert ".." not in key
    assert storage.get_path(key).is_file()


def test_get_path_rejects_path_traversal_key():
    with pytest.raises(AppError):
        storage.get_path("../../etc/passwd")
