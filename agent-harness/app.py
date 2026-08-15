from __future__ import annotations

import json
import hashlib
import os
import queue
import threading
from pathlib import Path
from typing import Any, Iterator

from deepseek_harness import DeepSeekHarness
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
SOUL = (ROOT / "prompts" / "soul.md").read_text(encoding="utf-8")
HARNESS_PROMPT = (ROOT / "prompts" / "harness.md").read_text(encoding="utf-8")
OPPORTUNITY_DETAIL_MEMORY = (ROOT / "prompts" / "opportunity-detail-memory.md").read_text(encoding="utf-8")
SYSTEM_PROMPT = f"{SOUL}\n\n{HARNESS_PROMPT}\n\n{OPPORTUNITY_DETAIL_MEMORY}"
MODEL = os.getenv("DSH_MODEL", "deepseek-v4-flash")
BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

app = FastAPI(title="Scale X AI Sales Partner Harness", version="0.1.0")
_lock = threading.Lock()
_harness: DeepSeekHarness | None = None
_harness_signature: tuple[str, str, str, str] | None = None


class ModelCandidate(BaseModel):
    model: str = Field(min_length=1, max_length=160)
    base_url: str = Field(min_length=1, max_length=500)
    api_key: str = Field(min_length=1, max_length=1000)


class RunInput(BaseModel):
    prompt: str = Field(min_length=1, max_length=120_000)
    session_id: str = Field(min_length=1, max_length=160)
    model: str | None = Field(default=None, min_length=1, max_length=160)
    base_url: str | None = Field(default=None, min_length=1, max_length=500)
    api_key: str | None = Field(default=None, min_length=1, max_length=1000)
    system_prompt: str | None = Field(default=None, min_length=1, max_length=60_000)
    fallback_models: list[ModelCandidate] = Field(default_factory=list, max_length=8)


def candidate_inputs(body: RunInput) -> list[RunInput]:
    configured = [ModelCandidate(
        model=body.model or MODEL,
        base_url=body.base_url or BASE_URL,
        api_key=body.api_key or os.getenv("DEEPSEEK_API_KEY", ""),
    ), *body.fallback_models]
    candidates: list[RunInput] = []
    for item in configured:
        model_session = hashlib.sha256(f"{item.model}|{item.base_url}".encode()).hexdigest()[:10]
        candidates.append(body.model_copy(update={
            "session_id": f"{body.session_id[:138]}--model-{model_session}",
            "model": item.model, "base_url": item.base_url, "api_key": item.api_key, "fallback_models": [],
        }))
    return candidates


def resolved_config(body: RunInput) -> tuple[str, str, str, str]:
    return (
        body.model or MODEL,
        body.base_url or BASE_URL,
        body.api_key or os.getenv("DEEPSEEK_API_KEY", ""),
        body.system_prompt or SYSTEM_PROMPT,
    )


def harness(body: RunInput) -> DeepSeekHarness:
    global _harness, _harness_signature
    model, base_url, api_key, system_prompt = resolved_config(body)
    if not api_key:
        raise HTTPException(status_code=503, detail="DEEPSEEK_API_KEY is not configured")
    signature = (model, base_url, hashlib.sha256(api_key.encode()).hexdigest(), hashlib.sha256(system_prompt.encode()).hexdigest())
    if _harness is None or _harness_signature != signature:
        if _harness is not None:
            _harness.close()
        _harness = DeepSeekHarness(
            provider="deepseek-official",
            model=model,
            max_tokens=8192,
            cwd=str(ROOT),
            cordis=str(ROOT / "cordis.yml"),
            session_root=str(ROOT / ".sessions"),
            env={
                "DSH_SYSTEM_PROMPT": system_prompt,
                "DSH_MODEL": model,
                "DEEPSEEK_API_KEY": api_key,
                "DEEPSEEK_BASE_URL": base_url,
            },
            # The API limits only the wait for the first streamed output. Once
            # streaming starts, give the model enough time to finish its answer.
            request_timeout_seconds=30,
        )
        _harness_signature = signature
    return _harness


@app.on_event("shutdown")
def shutdown() -> None:
    if _harness is not None:
        _harness.close()


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "configured": bool(os.getenv("DEEPSEEK_API_KEY")),
        "framework": "deepseek-harness",
        "sdkVersion": "0.1.0rc6",
        "model": MODEL,
    }


@app.post("/run")
def run_agent(body: RunInput) -> dict[str, Any]:
    errors: list[str] = []
    for candidate in candidate_inputs(body):
        try:
            with _lock:
                result = harness(candidate).run(candidate.prompt, session_id=candidate.session_id)
            if not (result.final_response or "").strip():
                raise RuntimeError("model returned an empty response")
            return {
                "sessionId": body.session_id,
                "content": result.final_response,
                "finishReason": result.finish_reason,
                "model": candidate.model or MODEL,
            }
        except Exception as exc:
            errors.append(str(exc)[:180])
    raise HTTPException(status_code=502, detail=f"All configured models failed: {' | '.join(errors)}")


def sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@app.post("/stream")
def stream_agent(body: RunInput) -> StreamingResponse:
    if not resolved_config(body)[2]:
        raise HTTPException(status_code=503, detail="DEEPSEEK_API_KEY is not configured")
    events: queue.Queue[dict[str, Any] | None] = queue.Queue()

    def worker() -> None:
        emitted = False

        def on_notification(notification: Any) -> None:
            nonlocal emitted
            if notification.method != "session.event":
                return
            event = notification.payload.get("event")
            if not isinstance(event, dict) or event.get("type") != "assistant/chunk":
                return
            data = event.get("data")
            chunk = data.get("chunk") if isinstance(data, dict) else None
            if isinstance(chunk, dict) and chunk.get("type") == "text-delta":
                text = chunk.get("text")
                if isinstance(text, str) and text:
                    emitted = True
                    events.put({"type": "delta", "content": text})

        errors: list[str] = []
        failed_models: list[str] = []
        candidates = candidate_inputs(body)
        for index, candidate in enumerate(candidates):
            emitted = False
            try:
                with _lock:
                    result = harness(candidate).run(candidate.prompt, session_id=candidate.session_id, on_notification=on_notification)
                if not emitted and not (result.final_response or "").strip():
                    raise RuntimeError("model returned an empty response")
                if not emitted and result.final_response:
                    events.put({"type": "delta", "content": result.final_response})
                events.put({"type": "done", "sessionId": body.session_id, "finishReason": result.finish_reason, "model": candidate.model or MODEL, "fallbackUsed": index > 0})
                events.put(None)
                return
            except Exception as exc:
                errors.append(str(exc)[:180])
                failed_models.append(candidate.model or MODEL)
                if index < len(candidates) - 1:
                    events.put({"type": "progress", "stage": "reasoning", "label": f"模型 {candidate.model or MODEL} 暂不可用，正在切换备用模型…", "failedModel": candidate.model or MODEL})
        events.put({"type": "error", "message": f"All configured models failed: {' | '.join(errors)}"[:500], "failedModels": failed_models})
        events.put(None)

    threading.Thread(target=worker, daemon=True).start()

    def iterator() -> Iterator[str]:
        yield sse({"type": "session", "sessionId": body.session_id})
        while True:
            item = events.get()
            if item is None:
                break
            yield sse(item)

    return StreamingResponse(iterator(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
