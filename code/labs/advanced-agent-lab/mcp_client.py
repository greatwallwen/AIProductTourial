from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any


PROTOCOL_VERSION = "2025-11-25"


class LocalMcpClient:
    def __init__(self, server: Path) -> None:
        self.server = server.resolve()
        self.process: subprocess.Popen[str] | None = None
        self.next_id = 1
        self.transcript: list[dict[str, Any]] = []

    def __enter__(self) -> "LocalMcpClient":
        child_env = os.environ.copy()
        child_env["PYTHONUTF8"] = "1"
        child_env["PYTHONIOENCODING"] = "utf-8"
        self.process = subprocess.Popen(
            [sys.executable, "-B", str(self.server)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            env=child_env,
        )
        initialized = self.request(
            "initialize",
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "advanced-agent-course", "version": "1.0.0"},
            },
        )
        negotiated = initialized.get("protocolVersion")
        if negotiated != PROTOCOL_VERSION:
            raise RuntimeError(f"unsupported MCP protocol version: {negotiated}")
        self.notify("notifications/initialized")
        return self

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        if self.process is None:
            return
        if self.process.stdin:
            self.process.stdin.close()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            self.process.wait(timeout=5)
        if self.process.returncode not in (0, None) and exc is None:
            stderr = self.process.stderr.read() if self.process.stderr else ""
            raise RuntimeError(f"MCP server exited with {self.process.returncode}: {stderr}")

    def _write(self, payload: dict[str, Any]) -> None:
        if self.process is None or self.process.stdin is None:
            raise RuntimeError("MCP client is not connected")
        self.transcript.append({"direction": "client_to_server", "message": payload})
        self.process.stdin.write(json.dumps(payload, ensure_ascii=False) + "\n")
        self.process.stdin.flush()

    def request(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        request_id = self.next_id
        self.next_id += 1
        payload: dict[str, Any] = {"jsonrpc": "2.0", "id": request_id, "method": method}
        if params is not None:
            payload["params"] = params
        self._write(payload)
        if self.process is None or self.process.stdout is None:
            raise RuntimeError("MCP client is not connected")
        line = self.process.stdout.readline()
        if not line:
            stderr = self.process.stderr.read() if self.process.stderr else ""
            raise RuntimeError(f"MCP server closed before responding: {stderr}")
        response = json.loads(line)
        self.transcript.append({"direction": "server_to_client", "message": response})
        if response.get("id") != request_id:
            raise RuntimeError("MCP response id does not match request")
        if "error" in response:
            raise RuntimeError(f"MCP error: {response['error']}")
        result = response.get("result")
        if not isinstance(result, dict):
            raise RuntimeError("MCP response result must be an object")
        return result

    def notify(self, method: str, params: dict[str, Any] | None = None) -> None:
        payload: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            payload["params"] = params
        self._write(payload)

    def list_tools(self) -> list[dict[str, Any]]:
        result = self.request("tools/list")
        tools = result.get("tools")
        if not isinstance(tools, list):
            raise RuntimeError("MCP tools/list did not return tools")
        return tools

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        result = self.request("tools/call", {"name": name, "arguments": arguments})
        content = result.get("structuredContent")
        if not isinstance(content, dict):
            raise RuntimeError("MCP tool result has no structuredContent")
        return content
