from app.db.session import SessionLocal
from app.models.category import Category


def test_builtin_categories_seeded():
    db = SessionLocal()
    try:
        builtins = db.query(Category).filter_by(is_builtin=True).all()
    finally:
        db.close()

    names = {c.name for c in builtins}
    assert names == {
        "Medical Billing",
        "Sales Support",
        "Front Desk / Patient Services",
        "Customer Support / Service",
        "Collections / Payment Follow-up",
    }
    assert all(c.owner_id is None for c in builtins)
