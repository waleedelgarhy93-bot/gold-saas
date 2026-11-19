"""
Authentication helpers: signed bearer tokens + hashed passwords.

- Tokens are signed with a secret (SECRET_KEY env, or a key file persisted in
  the data directory so logins survive restarts).
- Each token carries a fingerprint of the user's stored password hash, so
  changing a password logs out every old session of that user.
- Old plain-text passwords keep working and are upgraded to a hash on the
  next successful login.
"""
import os
import hashlib
import secrets

from flask import g, jsonify
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from werkzeug.security import generate_password_hash, check_password_hash

TOKEN_MAX_AGE_SECONDS = 30 * 24 * 3600  # 30 يوم
ADMIN_ROLES = ("shop_admin", "super_admin")
WEAK_PASSWORDS = {"123", "1234", "12345", "123456", "0000", "1111", "password", "admin"}
MIN_PASSWORD_LENGTH = 6

_HASH_PREFIXES = ("pbkdf2:", "scrypt:")


def _load_secret_key():
    env_key = os.environ.get("SECRET_KEY")
    if env_key:
        return env_key
    data_dir = os.environ.get("GOLD_DATA_DIR") or os.path.dirname(os.path.abspath(__file__))
    key_path = os.path.join(data_dir, ".secret_key")
    try:
        if os.path.exists(key_path):
            with open(key_path, "r", encoding="utf-8") as fh:
                key = fh.read().strip()
                if key:
                    return key
        key = secrets.token_hex(32)
        os.makedirs(data_dir, exist_ok=True)
        with open(key_path, "w", encoding="utf-8") as fh:
            fh.write(key)
        return key
    except Exception as exc:
        print(f"[auth] could not persist secret key ({exc}); sessions will reset on restart")
        return secrets.token_hex(32)


_serializer = URLSafeTimedSerializer(_load_secret_key(), salt="gold-auth-v1")


# ---------- Passwords ----------
def is_hashed(stored):
    return bool(stored) and stored.startswith(_HASH_PREFIXES)


def hash_password(raw):
    return generate_password_hash(raw)


def verify_password(user, raw):
    """True if raw matches. Upgrades a legacy plain-text password to a hash."""
    stored = user.password or ""
    if not stored or not raw:
        return False
    if is_hashed(stored):
        return check_password_hash(stored, raw)
    if secrets.compare_digest(stored.encode("utf-8"), raw.encode("utf-8")):
        user.password = hash_password(raw)  # caller commits
        return True
    return False


def is_weak_password(raw):
    raw = (raw or "").strip()
    return raw.lower() in WEAK_PASSWORDS or len(raw) < MIN_PASSWORD_LENGTH


def password_problem(raw):
    """Arabic error message if the new password is not acceptable, else None."""
    raw = (raw or "").strip()
    if len(raw) < MIN_PASSWORD_LENGTH:
        return f"كلمة المرور لازم تكون {MIN_PASSWORD_LENGTH} حروف/أرقام على الأقل"
    if raw.lower() in WEAK_PASSWORDS:
        return "كلمة المرور دي سهلة جداً، اختار كلمة أقوى"
    return None


# ---------- Tokens ----------
def _password_fingerprint(user):
    return hashlib.sha256((user.password or "").encode("utf-8")).hexdigest()[:16]


def issue_token(user, must_change=False):
    return _serializer.dumps({
        "uid": user.id,
        "pv": _password_fingerprint(user),
        "mc": bool(must_change),
    })


def read_token(token):
    try:
        return _serializer.loads(token, max_age=TOKEN_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None


def token_matches_user(payload, user):
    return payload.get("pv") == _password_fingerprint(user)


# ---------- Request helpers ----------
def unauthorized(msg="انتهت الجلسة، سجل الدخول مرة أخرى"):
    return jsonify({"detail": msg, "code": "unauthorized"}), 401


def forbidden(msg="غير مسموح لك بهذه العملية"):
    return jsonify({"detail": msg, "code": "forbidden"}), 403


def is_admin():
    return g.user_role in ADMIN_ROLES


def is_super_admin():
    return g.user_role == "super_admin"
