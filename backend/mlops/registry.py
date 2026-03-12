import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REGISTRY_PATH = os.path.join(BASE_DIR, "backend", "artifacts", "registry.json")


@dataclass
class RegistryModel:
    model_id: str
    model_type: str
    artifact_dir: str
    metrics: dict[str, Any]
    data_snapshot: dict[str, Any]
    status: str
    created_at: str


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_registry() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "production_model_id": None,
        "models": [],
        "updated_at": _utc_now(),
    }


def load_registry() -> dict[str, Any]:
    if not os.path.exists(REGISTRY_PATH):
        return _default_registry()
    with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "models" not in data:
        data["models"] = []
    if "production_model_id" not in data:
        data["production_model_id"] = None
    if "schema_version" not in data:
        data["schema_version"] = 1
    if "updated_at" not in data:
        data["updated_at"] = _utc_now()
    return data


def save_registry(registry: dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(REGISTRY_PATH), exist_ok=True)
    registry["updated_at"] = _utc_now()
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2)


def register_model(model_type: str, artifact_dir: str, metrics: dict[str, Any], data_snapshot: dict[str, Any]) -> str:
    registry = load_registry()
    model_id = f"{model_type}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    model = RegistryModel(
        model_id=model_id,
        model_type=model_type,
        artifact_dir=artifact_dir,
        metrics=metrics,
        data_snapshot=data_snapshot,
        status="staging",
        created_at=_utc_now(),
    )
    registry["models"].append(model.__dict__)
    save_registry(registry)
    return model_id


def promote_model(model_id: str) -> None:
    registry = load_registry()
    found = False
    for model in registry["models"]:
        if model["model_id"] == model_id:
            model["status"] = "production"
            found = True
        elif model.get("status") == "production":
            model["status"] = "archived"

    if not found:
        raise ValueError(f"Model id not found in registry: {model_id}")

    registry["production_model_id"] = model_id
    save_registry(registry)


def get_production_model() -> dict[str, Any] | None:
    registry = load_registry()
    model_id = registry.get("production_model_id")
    if not model_id:
        return None
    for model in registry["models"]:
        if model.get("model_id") == model_id:
            return model
    return None
