#!/usr/bin/env python3
"""Print a short-lived MaxKB token without persisting its credentials."""

import json
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main() -> int:
    if len(sys.argv) != 3:
        print(f"Usage: {Path(sys.argv[0]).name} LAUNCHER_PS1 MAXKB_URL", file=sys.stderr)
        return 2
    launcher = Path(sys.argv[1])
    base_url = sys.argv[2].rstrip("/")
    try:
        account_file = launcher.parent.parent / "01-环境与账号" / "maxkb-account.json"
        account = json.loads(account_file.read_text(encoding="utf-8-sig"))
        request = Request(
            f"{base_url}/admin/api/user/login",
            data=json.dumps({"username": account["username"], "password": account["password"]}).encode(),
            headers={"Content-Type": "application/json"}, method="POST",
        )
        with urlopen(request, timeout=10) as response:
            token = json.load(response).get("data", {}).get("token")
        if not token:
            raise ValueError("MaxKB login did not return a token")
    except (KeyError, OSError, ValueError, HTTPError, URLError, json.JSONDecodeError) as error:
        print(f"Unable to obtain MaxKB token: {error}", file=sys.stderr)
        return 1
    print(token)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
