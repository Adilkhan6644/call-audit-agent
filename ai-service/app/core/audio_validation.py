ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg"}
MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024

# Real file bytes, not the extension or client Content-Type, decide the type.
MAGIC_CHECKS = {
    ".wav": lambda h: h[:4] == b"RIFF" and h[8:12] == b"WAVE",
    ".ogg": lambda h: h[:4] == b"OggS",
    ".mp3": lambda h: h[:3] == b"ID3" or (len(h) >= 2 and h[0] == 0xFF and (h[1] & 0xE0) == 0xE0),
    ".m4a": lambda h: h[4:8] == b"ftyp",
}
