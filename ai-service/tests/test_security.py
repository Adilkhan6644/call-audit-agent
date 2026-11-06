from app.core.security import hash_password, verify_password


def test_hash_is_not_plaintext():
    hashed = hash_password("correct-password")
    assert hashed != "correct-password"


def test_verify_correct_password():
    hashed = hash_password("correct-password")
    assert verify_password("correct-password", hashed) is True


def test_verify_wrong_password():
    hashed = hash_password("correct-password")
    assert verify_password("wrong-password", hashed) is False
