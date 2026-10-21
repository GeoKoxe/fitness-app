from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./fitness.db"
    APP_ENV: str = "development"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

