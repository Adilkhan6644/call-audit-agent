import os
import sys

# Vercel's Python builder flattens this file to the function root (so `app/`,
# force-included via vercel.json, ends up alongside it) when run locally or
# if the builder preserves the api/ subfolder instead, `app/` is a sibling
# one level up — covering both keeps this working either way.
_here = os.path.dirname(os.path.abspath(__file__))
for _candidate in (_here, os.path.join(_here, "..")):
    if _candidate not in sys.path:
        sys.path.insert(0, _candidate)

from app.main import app  # noqa: E402
