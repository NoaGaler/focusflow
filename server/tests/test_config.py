from pymongo.uri_parser import parse_uri

from app.config import normalize_mongodb_uri

HOST = "cluster0.example.mongodb.net/?retryWrites=true&w=majority"


def check(raw, expected_password):
    uri = normalize_mongodb_uri(raw)
    parsed = parse_uri(uri.replace("mongodb+srv://", "mongodb://"))  # no DNS lookup in tests
    assert parsed["username"] == "noa_user"
    assert parsed["password"] == expected_password
    return uri


def test_plain_password_unchanged():
    assert check(f"mongodb+srv://noa_user:Abc123@{HOST}", "Abc123") == f"mongodb+srv://noa_user:Abc123@{HOST}"


def test_raw_special_characters_are_escaped():
    check(f"mongodb+srv://noa_user:ab@cd:e/f%g+h@{HOST}", "ab@cd:e/f%g+h")


def test_already_escaped_password_still_works():
    check(f"mongodb+srv://noa_user:ab%40UUj9@{HOST}", "ab@UUj9")


def test_whitespace_and_no_credentials():
    check(f"  mongodb+srv://noa_user:x@y@{HOST}\n", "x@y")
    assert normalize_mongodb_uri("mongodb://mongo:27017") == "mongodb://mongo:27017"
