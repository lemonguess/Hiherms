#!/usr/bin/env python3
"""HermesPet in-process Hermes Agent bridge.

This bridge is intentionally small. Electron talks to it over a local socket
using newline-delimited JSON. The bridge imports the installed Hermes Agent and
runs AIAgent.run_conversation() per HermesPet conversation session.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import queue
import shutil
import socket
import sys
import threading
import time
import traceback
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


DEFAULT_ENDPOINT = "tcp://127.0.0.1:18766" if os.name == "nt" else "ipc:///tmp/hermespet-agent-bridge.sock"
DEFAULT_AGENT_ROOT = "~/.hermes/hermes-agent"
DEFAULT_HERMES_HOME = "~/.hermes"


def _candidate_agent_roots(raw: str | None = None) -> list[Path]:
    candidates: list[Path] = []
    if raw:
        candidates.append(Path(raw).expanduser())
    env_root = os.environ.get("HERMES_AGENT_ROOT")
    if env_root:
        candidates.append(Path(env_root).expanduser())

    hermes_bin = shutil.which(os.environ.get("HERMES_BIN", "hermes"))
    if hermes_bin:
        bin_path = Path(hermes_bin).resolve()
        candidates.extend([
            bin_path.parent.parent,
            bin_path.parent.parent.parent,
            bin_path.parent.parent / "hermes-agent",
        ])

    candidates.extend([
        Path.cwd(),
        Path.cwd() / "hermes-agent",
        Path.home() / ".hermes" / "hermes-agent",
        Path.home() / "hermes-agent",
        Path("/opt/hermes/hermes-agent"),
        Path(DEFAULT_AGENT_ROOT).expanduser(),
    ])

    unique: list[Path] = []
    seen: set[str] = set()
    for candidate in candidates:
        try:
            resolved = candidate.resolve()
        except OSError:
            resolved = candidate
        key = str(resolved)
        if key not in seen:
            seen.add(key)
            unique.append(resolved)
    return unique


def _find_agent_root(raw: str | None = None) -> Path | None:
    for candidate in _candidate_agent_roots(raw):
        if (candidate / "run_agent.py").exists():
            return candidate
    return None


def _discover_agent_root(raw: str | None = None) -> Path:
    root = _find_agent_root(raw)
    if root is not None:
        return root
    attempted = ", ".join(str(path) for path in _candidate_agent_roots(raw))
    raise RuntimeError(f"Hermes Agent run_agent.py not found. Tried: {attempted}")


def _discover_hermes_home(raw: str | None = None) -> Path:
    if raw:
        return Path(raw).expanduser().resolve()
    env_home = os.environ.get("HERMES_HOME")
    if env_home:
        return Path(env_home).expanduser().resolve()
    return Path(DEFAULT_HERMES_HOME).expanduser().resolve()


def _ensure_agent_imports() -> None:
    root = _find_agent_root(os.environ.get("HERMES_AGENT_ROOT"))
    if root is not None:
        root_s = str(root)
        if root_s not in sys.path:
            sys.path.insert(0, root_s)
    elif importlib.util.find_spec("run_agent") is None:
        raise RuntimeError("Hermes Agent is not importable and HERMES_AGENT_ROOT was not found.")
    os.environ.setdefault("HERMES_HOME", str(_discover_hermes_home()))


def _jsonable(value: Any) -> Any:
    try:
        json.dumps(value)
        return value
    except TypeError:
        if isinstance(value, dict):
            return {str(k): _jsonable(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [_jsonable(v) for v in value]
        return str(value)


def _load_cfg() -> dict[str, Any]:
    _ensure_agent_imports()
    try:
        from hermes_cli.config import load_config

        cfg = load_config()
        return cfg if isinstance(cfg, dict) else {}
    except Exception:
        return {}


def _resolve_model(cfg: dict[str, Any]) -> str:
    env_model = (os.environ.get("HERMES_MODEL", "") or os.environ.get("HERMES_INFERENCE_MODEL", "")).strip()
    if env_model:
        return env_model
    model_cfg = cfg.get("model", "")
    if isinstance(model_cfg, dict):
        return str(model_cfg.get("default") or model_cfg.get("model") or "").strip()
    if isinstance(model_cfg, str):
        return model_cfg.strip()
    return ""


def _resolve_runtime(model: str, provider: str | None = None) -> dict[str, Any]:
    _ensure_agent_imports()
    from hermes_cli.runtime_provider import resolve_runtime_provider

    requested = provider or os.environ.get("HERMES_INFERENCE_PROVIDER", "").strip() or None
    return resolve_runtime_provider(requested=requested, target_model=model or None)


def _load_toolsets(cfg: dict[str, Any]) -> list[str] | None:
    _ensure_agent_imports()
    raw = os.environ.get("HERMESPET_BRIDGE_TOOLSETS", "").strip()
    if raw:
        values = [part.strip() for part in raw.split(",") if part.strip()]
        if any(value in {"all", "*"} for value in values):
            return None
        return values or None

    try:
        from hermes_cli.tools_config import _get_platform_tools

        enabled = sorted(_get_platform_tools(cfg, "cli", include_default_mcp_servers=True))
        return enabled or None
    except Exception:
        return None


def _max_turns(cfg: dict[str, Any], default: int = 90) -> int:
    try:
        env_max = int(os.environ.get("HERMESPET_BRIDGE_MAX_TURNS", "") or 0)
        if env_max > 0:
            return env_max
    except ValueError:
        pass
    agent_cfg = cfg.get("agent") or {}
    try:
        return int(agent_cfg.get("max_turns") or cfg.get("max_turns") or default)
    except (TypeError, ValueError):
        return default


@contextmanager
def _approval_scope(pool: "AgentPool", session_id: str):
    previous_callback = None
    previous_exec_ask = os.environ.get("HERMES_EXEC_ASK")
    try:
        from tools.terminal_tool import _get_approval_callback, set_approval_callback

        previous_callback = _get_approval_callback()

        def deny(command: str, description: str, *, allow_permanent: bool = True) -> str:
            pool.append_event(session_id, {
                "event": "approval.requested",
                "command": str(command or ""),
                "description": str(description or ""),
                "choices": ["deny"],
                "allow_permanent": bool(allow_permanent),
            })
            pool.append_event(session_id, {
                "event": "approval.resolved",
                "choice": "deny",
            })
            return "deny"

        set_approval_callback(deny)
        os.environ["HERMES_EXEC_ASK"] = "1"
    except Exception:
        pass
    try:
        yield
    finally:
        try:
            from tools.terminal_tool import set_approval_callback

            set_approval_callback(previous_callback)
        except Exception:
            pass
        if previous_exec_ask is None:
            os.environ.pop("HERMES_EXEC_ASK", None)
        else:
            os.environ["HERMES_EXEC_ASK"] = previous_exec_ask


@dataclass
class RunRecord:
    run_id: str
    session_id: str
    status: str = "running"
    started_at: float = field(default_factory=time.time)
    ended_at: float | None = None
    deltas: list[str] = field(default_factory=list)
    events: list[dict[str, Any]] = field(default_factory=list)
    result: dict[str, Any] | None = None
    error: str | None = None


@dataclass
class AgentSession:
    session_id: str
    agent: Any
    history: list[dict[str, Any]] = field(default_factory=list)
    config: dict[str, Any] = field(default_factory=dict)
    running: bool = False
    current_run_id: str | None = None
    lock: threading.RLock = field(default_factory=threading.RLock)
    last_used_at: float = field(default_factory=time.time)


class AgentPool:
    def __init__(self) -> None:
        self._sessions: dict[str, AgentSession] = {}
        self._runs: dict[str, RunRecord] = {}
        self._lock = threading.RLock()
        self._run_lock = threading.Lock()

    def append_event(self, session_id: str, event: dict[str, Any]) -> None:
        with self._lock:
            session = self._sessions.get(session_id)
            run_id = session.current_run_id if session else None
            if run_id and run_id in self._runs:
                self._runs[run_id].events.append(_jsonable(event))

    def get_or_create(self, session_id: str, model: str | None = None, provider: str | None = None) -> AgentSession:
        with self._lock:
            existing = self._sessions.get(session_id)
            if existing is not None:
                existing.last_used_at = time.time()
                return existing

            _ensure_agent_imports()
            from run_agent import AIAgent

            cfg = _load_cfg()
            resolved_model = (model or "").strip() or _resolve_model(cfg)
            runtime = _resolve_runtime(resolved_model, (provider or "").strip() or None)

            kwargs = dict(
                model=resolved_model,
                max_iterations=_max_turns(cfg),
                provider=runtime.get("provider"),
                base_url=runtime.get("base_url"),
                api_key=runtime.get("api_key"),
                api_mode=runtime.get("api_mode"),
                acp_command=runtime.get("command"),
                acp_args=runtime.get("args"),
                credential_pool=runtime.get("credential_pool"),
                quiet_mode=True,
                verbose_logging=False,
                enabled_toolsets=_load_toolsets(cfg),
                platform="cli",
                session_id=session_id,
                status_callback=self._status_callback(session_id),
                thinking_callback=self._text_event_callback(session_id, "thinking.delta"),
                reasoning_callback=self._text_event_callback(session_id, "reasoning.delta"),
                tool_progress_callback=self._tool_progress_callback(session_id),
                tool_start_callback=self._tool_start_callback(session_id),
                tool_complete_callback=self._tool_complete_callback(session_id),
                clarify_callback=self._clarify_callback,
            )
            try:
                agent = AIAgent(**kwargs)
            except TypeError:
                kwargs.pop("clarify_callback", None)
                agent = AIAgent(**kwargs)

            session = AgentSession(
                session_id=session_id,
                agent=agent,
                config={
                    "model": resolved_model,
                    "provider": runtime.get("provider"),
                    "base_url": runtime.get("base_url"),
                },
            )
            self._sessions[session_id] = session
            return session

    def _status_callback(self, session_id: str):
        def callback(kind, text=None):
            self.append_event(session_id, {"event": "status", "kind": str(kind), "text": None if text is None else str(text)})

        return callback

    def _text_event_callback(self, session_id: str, event_name: str):
        def callback(text):
            self.append_event(session_id, {"event": event_name, "text": str(text)})

        return callback

    def _tool_start_callback(self, session_id: str):
        def callback(tool_call_id, function_name, function_args):
            self.append_event(session_id, {
                "event": "tool.started",
                "tool_call_id": str(tool_call_id) if tool_call_id else "",
                "tool_name": str(function_name) if function_name else "",
                "args": _jsonable(function_args) if function_args else {},
            })

        return callback

    def _tool_complete_callback(self, session_id: str):
        def callback(tool_call_id, function_name, function_args, function_result=None):
            self.append_event(session_id, {
                "event": "tool.completed",
                "tool_call_id": str(tool_call_id) if tool_call_id else "",
                "tool_name": str(function_name) if function_name else "",
                "args": _jsonable(function_args) if function_args else {},
                "result": _jsonable(function_result) if function_result is not None else None,
            })

        return callback

    def _tool_progress_callback(self, session_id: str):
        def callback(event_type, function_name=None, preview=None, function_args=None, **kwargs):
            if event_type == "reasoning.available":
                self.append_event(session_id, {"event": "reasoning.available", "text": str(preview) if preview else ""})
            elif event_type and event_type not in {"tool.started", "tool.completed"}:
                self.append_event(session_id, {
                    "event": str(event_type),
                    "tool_name": str(function_name) if function_name else "",
                    "preview": str(preview) if preview else "",
                    "args": _jsonable(function_args) if function_args else {},
                    "extra": _jsonable(kwargs),
                })

        return callback

    @staticmethod
    def _clarify_callback(question: str, choices=None) -> str:
        if choices:
            return f"[HermesPet bridge: choose the best option from {choices} and continue.]"
        return "[HermesPet bridge: make the most reasonable assumption and continue.]"

    def start_chat(
        self,
        session_id: str,
        message: Any,
        instructions: str | None = None,
        conversation_history: list[dict[str, Any]] | None = None,
        model: str | None = None,
        provider: str | None = None,
    ) -> RunRecord:
        session = self.get_or_create(session_id, model=model, provider=provider)
        with session.lock:
            if session.running:
                raise RuntimeError(f"session {session_id} is already running")
            run_id = uuid.uuid4().hex
            record = RunRecord(run_id=run_id, session_id=session_id)
            with self._lock:
                self._runs[run_id] = record
            session.running = True
            session.current_run_id = run_id
            session.last_used_at = time.time()

        thread = threading.Thread(
            target=self._run_chat,
            args=(session, record, message, instructions, conversation_history),
            daemon=True,
            name=f"hermespet-bridge-run-{run_id[:8]}",
        )
        thread.start()
        return record

    def _run_chat(
        self,
        session: AgentSession,
        record: RunRecord,
        message: Any,
        instructions: str | None,
        conversation_history: list[dict[str, Any]] | None,
    ) -> None:
        with self._run_lock:
            def stream_callback(delta: str) -> None:
                with self._lock:
                    record.deltas.append(str(delta))

            try:
                with _approval_scope(self, session.session_id):
                    history = conversation_history if isinstance(conversation_history, list) else session.history
                    kwargs: dict[str, Any] = {
                        "conversation_history": history,
                        "stream_callback": stream_callback,
                        "task_id": session.session_id,
                    }
                    if instructions:
                        kwargs["system_message"] = instructions
                    result = session.agent.run_conversation(message, **kwargs)
                    result = _jsonable(result if isinstance(result, dict) else {"final_response": str(result)})
                    final_response = result.get("final_response") if isinstance(result, dict) else None
                    if final_response:
                        with self._lock:
                            if not record.deltas:
                                record.deltas.append(str(final_response))
                    with session.lock:
                        if isinstance(result.get("messages"), list):
                            session.history = result["messages"]
                        record.status = "interrupted" if result.get("interrupted") else "complete"
                        record.result = result
                        record.ended_at = time.time()
            except Exception as exc:
                with session.lock:
                    record.status = "error"
                    record.error = str(exc)
                    record.result = {"error": str(exc), "traceback": traceback.format_exc()}
                    record.ended_at = time.time()
            finally:
                with session.lock:
                    session.running = False
                    session.current_run_id = None
                    session.last_used_at = time.time()

    def get_output(self, run_id: str, cursor: int = 0, event_cursor: int = 0) -> dict[str, Any]:
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                raise KeyError(f"unknown run: {run_id}")
            deltas = list(record.deltas)
            events = list(record.events)
            done = record.status != "running"
            return {
                "run_id": run_id,
                "session_id": record.session_id,
                "status": record.status,
                "delta": "".join(deltas[cursor:]),
                "output": "".join(deltas),
                "cursor": len(deltas),
                "events": events[event_cursor:],
                "event_cursor": len(events),
                "done": done,
                "result": record.result if done else None,
                "error": record.error,
            }

    def interrupt(self, session_id: str) -> dict[str, Any]:
        with self._lock:
            session = self._sessions.get(session_id)
        if session is None:
            return {"interrupted": False, "reason": "unknown session"}
        if hasattr(session.agent, "interrupt"):
            session.agent.interrupt("Interrupted by HermesPet user.")
            return {"interrupted": True}
        return {"interrupted": False, "reason": "agent does not support interrupt"}


class BridgeServer:
    def __init__(self, endpoint: str) -> None:
        self.endpoint = endpoint
        self.pool = AgentPool()
        self.shutdown_event = threading.Event()

    def handle(self, payload: dict[str, Any]) -> dict[str, Any]:
        action = str(payload.get("action") or "")
        if action == "ping":
            return {"pong": True}
        if action == "chat":
            record = self.pool.start_chat(
                session_id=str(payload.get("session_id") or ""),
                message=payload.get("message") or "",
                instructions=str(payload.get("instructions") or "") or None,
                conversation_history=payload.get("conversation_history") if isinstance(payload.get("conversation_history"), list) else None,
                model=str(payload.get("model") or "") or None,
                provider=str(payload.get("provider") or "") or None,
            )
            return {"run_id": record.run_id, "session_id": record.session_id, "status": record.status}
        if action == "get_output":
            return self.pool.get_output(
                str(payload.get("run_id") or ""),
                int(payload.get("cursor") or 0),
                int(payload.get("event_cursor") or 0),
            )
        if action == "interrupt":
            return self.pool.interrupt(str(payload.get("session_id") or ""))
        if action == "shutdown":
            self.shutdown_event.set()
            return {"shutdown": True}
        raise RuntimeError(f"unsupported action: {action}")

    def serve_forever(self) -> None:
        sock = self._bind_socket()
        print(json.dumps({"event": "ready", "endpoint": self.endpoint}), flush=True)
        try:
            sock.settimeout(0.25)
            while not self.shutdown_event.is_set():
                try:
                    conn, _addr = sock.accept()
                except TimeoutError:
                    continue
                except socket.timeout:
                    continue
                threading.Thread(target=self._handle_conn, args=(conn,), daemon=True).start()
        finally:
            sock.close()
            if self.endpoint.startswith("ipc://"):
                try:
                    Path(self.endpoint[len("ipc://"):]).unlink()
                except OSError:
                    pass

    def _bind_socket(self) -> socket.socket:
        if self.endpoint.startswith("ipc://"):
            path = Path(self.endpoint[len("ipc://"):])
            try:
                path.unlink()
            except OSError:
                pass
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            sock.bind(str(path))
            sock.listen(20)
            return sock

        if self.endpoint.startswith("tcp://"):
            url = urlparse(self.endpoint)
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((url.hostname or "127.0.0.1", int(url.port or "18766")))
            sock.listen(20)
            return sock

        raise RuntimeError(f"unsupported endpoint: {self.endpoint}")

    def _handle_conn(self, conn: socket.socket) -> None:
        try:
            raw = self._read_line(conn)
            payload = json.loads(raw)
            result = self.handle(payload)
            response = {"ok": True, **_jsonable(result)}
        except Exception as exc:
            response = {"ok": False, "error": str(exc)}
        try:
            conn.sendall((json.dumps(response, ensure_ascii=False) + "\n").encode("utf-8"))
        finally:
            conn.close()

    @staticmethod
    def _read_line(conn: socket.socket) -> str:
        chunks: list[bytes] = []
        while True:
            chunk = conn.recv(4096)
            if not chunk:
                break
            newline = chunk.find(b"\n")
            if newline >= 0:
                chunks.append(chunk[:newline])
                break
            chunks.append(chunk)
        return b"".join(chunks).decode("utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--endpoint", default=os.environ.get("HERMESPET_BRIDGE_ENDPOINT") or DEFAULT_ENDPOINT)
    parser.add_argument("--agent-root")
    parser.add_argument("--hermes-home")
    args = parser.parse_args()

    if args.agent_root:
        os.environ["HERMES_AGENT_ROOT"] = str(_discover_agent_root(args.agent_root))
    else:
        root = _find_agent_root()
        if root is not None:
            os.environ["HERMES_AGENT_ROOT"] = str(root)
    if args.hermes_home:
        os.environ["HERMES_HOME"] = str(_discover_hermes_home(args.hermes_home))

    server = BridgeServer(args.endpoint)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
