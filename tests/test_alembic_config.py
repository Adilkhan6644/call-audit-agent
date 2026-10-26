from app.core.config import settings
from app.db.migration_url import get_database_url


def test_migration_url_matches_app_settings():
    assert get_database_url() == settings.database_url
