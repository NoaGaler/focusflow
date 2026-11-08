"""Request bodies and their validation (pydantic). Anything invalid -> 422."""
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

# ---------------------------------------------------------------- users


def check_password_strength(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(password.encode("utf-8")) > 72:  # bcrypt only uses the first 72 bytes
        raise ValueError("Password is too long (max 72 bytes)")
    if not any(c.isalpha() for c in password) or not re.search(r"\d", password):
        raise ValueError("Password must contain at least one letter and one digit")
    return password


def clean_display_name(name: str) -> str:
    name = " ".join(name.split())
    if not 1 <= len(name) <= 50:
        raise ValueError("Display name must be 1-50 characters")
    return name


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_max_length=60000)


class RegisterIn(Strict):
    email: EmailStr
    password: str
    display_name: str

    _pw = field_validator("password")(check_password_strength)
    _name = field_validator("display_name")(clean_display_name)


class LoginIn(Strict):
    email: EmailStr
    password: str = Field(max_length=200)


class UpdateMeIn(Strict):
    display_name: str

    _name = field_validator("display_name")(clean_display_name)


class ChangePasswordIn(Strict):
    current_password: str = Field(max_length=200)
    new_password: str

    _pw = field_validator("new_password")(check_password_strength)


# ---------------------------------------------------------------- content

YOUTUBE_ID = re.compile(
    r"^(?:https?://)?(?:www\.|m\.|music\.)?"
    r"(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/|live/)|youtu\.be/)"
    r"([A-Za-z0-9_-]{11})(?:[?&#/].*)?$"
)


def youtube_video_id(url: str) -> str | None:
    m = YOUTUBE_ID.match(url.strip())
    return m.group(1) if m else None


class ContentIn(Strict):
    type: Literal["youtube", "text"]
    title: str
    source: str  # YouTube link, or the text itself

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        v = " ".join(v.split())
        if not 1 <= len(v) <= 200:
            raise ValueError("Title must be 1-200 characters")
        return v

    @model_validator(mode="after")
    def _source(self):
        if self.type == "youtube":
            video_id = youtube_video_id(self.source)
            if not video_id:
                raise ValueError("This is not a valid YouTube link")
            self.source = f"https://www.youtube.com/watch?v={video_id}"  # normalized
        else:
            text = self.source.strip()
            if len(text) < 20:
                raise ValueError("Text must be at least 20 characters")
            if len(text) > 50000:
                raise ValueError("Text is too long (max 50,000 characters)")
            self.source = text
        return self


# ---------------------------------------------------------------- sessions


class SessionIn(Strict):
    content_id: str = Field(max_length=64)


class ReadingIn(Strict):
    # Video: seconds from the start. Text: how far the user scrolled, 0-100 (%).
    position: float = Field(ge=0, le=100000)
    score: float = Field(ge=0, le=1)
    # Optional: the model's 5-level class (0 = not in camera ... 4 = very engaged)
    level: int | None = Field(default=None, ge=0, le=4)
