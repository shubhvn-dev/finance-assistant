from pathlib import Path


def test_schema_enables_pgcrypto_for_uuid_defaults():
    schema = Path(__file__).resolve().parents[1] / "schema.sql"
    contents = schema.read_text()

    assert "CREATE EXTENSION IF NOT EXISTS pgcrypto;" in contents
