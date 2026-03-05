#!/usr/bin/env python3
"""
Reproduce MCP stdio protocol corruption checks for this repository.

It probes different startup commands by:
1) spawning the server process
2) writing an MCP initialize request to stdin
3) reading first bytes from stdout
4) checking whether stdout starts with JSON ("{") or non-JSON bytes
"""

from __future__ import annotations

import argparse
import json
import os
import select
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List


INIT_REQUEST = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "repro-script", "version": "1.0.0"},
    },
}


@dataclass
class ProbeCase:
    name: str
    cmd: List[str]
    expected_json_on_stdout: bool


def read_some(pipe, wait_seconds: float, max_bytes: int) -> bytes:
    fd = pipe.fileno()
    deadline = time.time() + wait_seconds
    data = b""
    while time.time() < deadline and len(data) < max_bytes:
        timeout = max(0.0, min(0.1, deadline - time.time()))
        ready, _, _ = select.select([fd], [], [], timeout)
        if not ready:
            continue
        chunk = os.read(fd, max_bytes - len(data))
        if not chunk:
            break
        data += chunk
        # We only need the first chunk to classify.
        if data:
            break
    return data


def terminate_process(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=0.6)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=0.6)


def preview_text(data: bytes, limit: int = 64) -> str:
    if not data:
        return ""
    return data[:limit].decode("utf-8", errors="replace").replace("\n", "\\n")


def run_probe(case: ProbeCase, cwd: Path, wait_seconds: float, max_bytes: int) -> dict:
    proc = subprocess.Popen(
        case.cmd,
        cwd=str(cwd),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        payload = json.dumps(INIT_REQUEST, ensure_ascii=False) + "\n"
        assert proc.stdin is not None
        proc.stdin.write(payload.encode("utf-8"))
        proc.stdin.flush()

        assert proc.stdout is not None
        assert proc.stderr is not None
        out = read_some(proc.stdout, wait_seconds=wait_seconds, max_bytes=max_bytes)
        err = read_some(proc.stderr, wait_seconds=0.25, max_bytes=max_bytes)
    finally:
        terminate_process(proc)

    starts_with_json = out.startswith(b"{")
    first8_hex = out[:8].hex() if out else ""
    return {
        "name": case.name,
        "cmd": case.cmd,
        "expected_json": case.expected_json_on_stdout,
        "starts_with_json": starts_with_json,
        "first8_hex": first8_hex,
        "stdout_preview": preview_text(out),
        "stderr_preview": preview_text(err),
        "pass": starts_with_json == case.expected_json_on_stdout,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reproduce MCP stdio stream corruption behavior."
    )
    parser.add_argument(
        "--repo-root",
        default=str(Path(__file__).resolve().parents[1]),
        help="Repository root path (default: auto-detected).",
    )
    parser.add_argument(
        "--openapi",
        default="./test-openapi.json",
        help="OpenAPI source passed to CLI commands.",
    )
    parser.add_argument(
        "--streamable-port",
        type=int,
        default=39321,
        help="Port used for streamable probe case.",
    )
    parser.add_argument(
        "--wait-seconds",
        type=float,
        default=0.8,
        help="Seconds to wait for first stdout bytes.",
    )
    parser.add_argument(
        "--max-bytes",
        type=int,
        default=256,
        help="Max bytes to capture per stream preview.",
    )
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    cli_interactive = repo_root / "packages/mcp-swagger-server/dist/cli-interactive.js"
    cli_standard = repo_root / "packages/mcp-swagger-server/dist/cli.js"

    if not cli_interactive.exists() or not cli_standard.exists():
        print("dist files not found. Please build first:")
        print("  pnpm -C packages/mcp-swagger-server build")
        return 2

    cases = [
        ProbeCase(
            name="interactive + streamable (expected: NON-JSON on stdout)",
            cmd=[
                "node",
                str(cli_interactive),
                "--openapi",
                args.openapi,
                "--transport",
                "streamable",
                "--port",
                str(args.streamable_port),
            ],
            expected_json_on_stdout=False,
        ),
        ProbeCase(
            name="interactive + stdio (expected: JSON on stdout)",
            cmd=[
                "node",
                str(cli_interactive),
                "--openapi",
                args.openapi,
                "--transport",
                "stdio",
            ],
            expected_json_on_stdout=True,
        ),
        ProbeCase(
            name="standard cli + stdio (expected: JSON on stdout)",
            cmd=[
                "node",
                str(cli_standard),
                "--openapi",
                args.openapi,
                "--transport",
                "stdio",
            ],
            expected_json_on_stdout=True,
        ),
    ]

    print("MCP stdio corruption repro")
    print(f"repo_root: {repo_root}")
    print()

    failed = 0
    for case in cases:
        result = run_probe(
            case, cwd=repo_root, wait_seconds=args.wait_seconds, max_bytes=args.max_bytes
        )
        status = "PASS" if result["pass"] else "FAIL"
        print(f"[{status}] {result['name']}")
        print("  cmd:", " ".join(result["cmd"]))
        print("  first8_hex:", result["first8_hex"] or "(empty)")
        print("  stdout_preview:", result["stdout_preview"] or "(empty)")
        print("  stderr_preview:", result["stderr_preview"] or "(empty)")
        if not result["pass"]:
            failed += 1
        print()

    if failed:
        print(f"Done with {failed} failed case(s).")
        return 1
    print("Done. All cases matched expected behavior.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

