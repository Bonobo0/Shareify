#!/usr/bin/env python3
"""Simple Shareify CLI helper for authenticating and uploading files via the private API."""

import argparse
import getpass
import hashlib
import json
import math
import mimetypes
import os
import sys
from dataclasses import dataclass
from typing import Callable, Dict, Iterable, Optional

import requests

try:
    # type: ignore[import-error]
    from cryptography.hazmat.backends import default_backend
    # type: ignore[import-error]
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
except ImportError:  # pragma: no cover - optional dependency
    Cipher = None
    algorithms = None
    modes = None
    default_backend = None


CHUNK_SIZE = 5 * 1024 * 1024
AES_CTR_MODE = 2
UPLOAD_CHUNK_SIZE = 8 * 1024 * 1024
AUTH_TAG_SIZE = 32
AUTH_TAG_CONTEXT = b"shareify-e2ee-v1"


@dataclass
class UploadPlan:
    filename: str
    content_length: int
    mime_type: str
    is_encrypted: bool
    original_metadata: Optional[Dict[str, object]]
    stream_factory: Callable[[], Iterable[bytes]]

    def stream(self) -> Iterable[bytes]:
        return self.stream_factory()


class _SizedStream:
    def __init__(self, iterator: Iterable[bytes], length: int):
        self._iterator = iterator
        self._length = length

    def __iter__(self):
        for chunk in self._iterator:
            yield chunk

    def __len__(self):  # pragma: no cover - exercised at runtime by requests
        return self._length

    def close(self):
        closer = getattr(self._iterator, "close", None)
        if callable(closer):
            closer()


def _print_error(message: str) -> None:
    sys.stderr.write(f"Error: {message}\n")


def _require_encryption_support() -> None:
    if Cipher is None:
        raise RuntimeError(
            "Client-side encryption requires the 'cryptography' package. Install it with 'pip install cryptography'."
        )


def _counter_for_chunk(initial_counter: bytes, chunk_index: int) -> bytes:
    prefix = initial_counter[:8]
    suffix_value = int.from_bytes(initial_counter[8:], "big")
    new_suffix = ((suffix_value + chunk_index) % (1 << 64)).to_bytes(8, "big")
    return prefix + new_suffix


def authenticate(
    base_url: str,
    email: str,
    password: str,
    two_factor: Optional[str],
    use_backup: bool,
) -> str:
    payload = {
        "email": email,
        "password": password,
    }

    if two_factor:
        payload["twoFactorCode"] = two_factor
        payload["useBackupCode"] = use_backup

    try:
        response = requests.post(
            f"{base_url}/api/cli/auth", json=payload, timeout=30)
    except requests.RequestException as exc:
        raise RuntimeError(f"로그인 중 네트워크 오류가 발생했습니다: {exc}") from exc

    if response.status_code != 200:
        try:
            data = response.json()
        except ValueError:
            data = {"error": response.text or "Unknown error"}
        raise RuntimeError(data.get("error", "로그인에 실패했습니다."))

    data = response.json()
    token = data.get("token")
    if not token:
        raise RuntimeError("인증 토큰을 받지 못했습니다.")

    return token


def load_credentials(path: str) -> Dict[str, str]:
    credentials: Dict[str, str] = {}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    continue
                if "=" not in stripped:
                    continue
                key, value = stripped.split("=", 1)
                credentials[key.strip().upper()] = value.strip()
    except FileNotFoundError:
        return {}
    except OSError as exc:
        raise RuntimeError(f"자격 증명 파일을 읽는 중 오류가 발생했습니다: {exc}") from exc

    return credentials


def request_upload(
    base_url: str,
    token: str,
    *,
    filename: str,
    size: int,
    mime_type: str,
    directory_id: Optional[str],
    is_encrypted: bool,
    original_metadata: Optional[Dict[str, object]],
    share_hash: Optional[str],
) -> Dict[str, object]:
    payload: Dict[str, object] = {
        "filename": filename,
        "size": size,
        "mimetype": mime_type,
    }

    if directory_id:
        payload["directoryId"] = directory_id

    if share_hash:
        payload["shareHash"] = share_hash

    if is_encrypted and original_metadata:
        payload["isEncrypted"] = True
        payload["originalMetadata"] = original_metadata

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            f"{base_url}/api/cli/upload",
            headers=headers,
            data=json.dumps(payload),
            timeout=30,
        )
    except requests.RequestException as exc:
        raise RuntimeError(f"사전 업로드 요청 중 네트워크 오류가 발생했습니다: {exc}") from exc

    if response.status_code != 200:
        try:
            data = response.json()
        except ValueError:
            data = {"error": response.text or "사전 업로드 요청이 실패했습니다."}
        message = data.get("error", "사전 업로드 요청이 실패했습니다.")
        retry_after = response.headers.get("Retry-After")
        if retry_after:
            message = f"{message} (Retry-After: {retry_after}s)"
        raise RuntimeError(message)

    data = response.json()
    upload_url = data.get("uploadUrl")
    file_info = data.get("file")

    if not upload_url or not file_info:
        raise RuntimeError("업로드 URL 또는 파일 정보를 받지 못했습니다.")

    return {
        "upload_url": upload_url,
        "file": file_info,
    }


def perform_upload(upload_url: str, plan: UploadPlan) -> None:
    headers = {
        "Content-Type": plan.mime_type,
    }
    iterator = plan.stream()
    stream = _SizedStream(iterator, plan.content_length)
    try:
        try:
            response = requests.put(
                upload_url,
                data=stream,
                headers=headers,
                timeout=300,
            )
        except requests.RequestException as exc:
            raise RuntimeError(f"파일 전송 중 네트워크 오류가 발생했습니다: {exc}") from exc
    finally:
        try:
            stream.close()
        except AttributeError:
            pass
        except Exception:  # pragma: no cover - best effort cleanup
            pass

    if response.status_code not in (200, 201, 204):
        raise RuntimeError(f"파일 전송 실패 (status: {response.status_code})")


def finalize_upload(base_url: str, token: str, file_id: str) -> Dict[str, object]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.patch(
            f"{base_url}/api/cli/upload",
            headers=headers,
            data=json.dumps({"fileId": file_id}),
            timeout=30,
        )
    except requests.RequestException as exc:
        raise RuntimeError(f"업로드 완료 처리 중 네트워크 오류가 발생했습니다: {exc}") from exc

    if response.status_code != 200:
        try:
            data = response.json()
        except ValueError:
            data = {"error": response.text or "업로드 완료 처리 실패"}
        raise RuntimeError(data.get("error", "업로드 완료 처리 실패"))

    return response.json()


def build_plain_upload_plan(
    file_path: str,
    forced_mime: Optional[str],
    *,
    is_encrypted: bool = False,
    original_metadata: Optional[Dict[str, object]] = None,
) -> UploadPlan:
    if is_encrypted and not original_metadata:
        raise RuntimeError("암호화된 파일로 표시하려면 원본 메타데이터를 제공해야 합니다.")

    file_name = os.path.basename(file_path)
    file_size = os.path.getsize(file_path)
    guessed_mime, _ = mimetypes.guess_type(file_path)
    mime_type = forced_mime or guessed_mime or "application/octet-stream"

    def stream_factory() -> Iterable[bytes]:
        def generator() -> Iterable[bytes]:
            with open(file_path, "rb") as source:
                while True:
                    chunk = source.read(UPLOAD_CHUNK_SIZE)
                    if not chunk:
                        break
                    yield chunk

        return generator()

    return UploadPlan(
        filename=file_name,
        content_length=file_size,
        mime_type=mime_type,
        is_encrypted=is_encrypted,
        original_metadata=original_metadata,
        stream_factory=stream_factory,
    )


def build_encryption_plan(
    file_path: str,
    password: str,
    forced_mime: Optional[str],
) -> UploadPlan:
    if not password:
        raise RuntimeError("암호화 비밀번호가 필요합니다.")

    _require_encryption_support()

    file_name = os.path.basename(file_path)
    original_size = os.path.getsize(file_path)
    original_mime, _ = mimetypes.guess_type(file_path)
    original_mime = original_mime or "application/octet-stream"

    salt = os.urandom(16)
    counter = os.urandom(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        100000,
        dklen=32,
    )

    auth_tag_input = salt + password.encode("utf-8") + AUTH_TAG_CONTEXT
    auth_tag = hashlib.sha256(auth_tag_input).digest()

    total_chunks = math.ceil(
        original_size / CHUNK_SIZE) if original_size else 0
    header = bytearray()
    header.append(AES_CTR_MODE)
    header.extend(salt)
    header.extend(counter)
    header.extend((total_chunks | 0x80000000).to_bytes(4, "little"))
    header.extend(auth_tag)
    header_bytes = bytes(header)

    encrypted_size = len(header_bytes) + original_size
    upload_filename = f"{file_name}.encrypted"
    mime_type = forced_mime or "application/octet-stream"

    def stream_factory() -> Iterable[bytes]:
        def generator() -> Iterable[bytes]:
            yield header_bytes
            if total_chunks == 0:
                return

            with open(file_path, "rb") as source:
                for chunk_index in range(total_chunks):
                    chunk = source.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    chunk_counter = _counter_for_chunk(counter, chunk_index)
                    cipher = Cipher(
                        algorithms.AES(key),
                        modes.CTR(chunk_counter),
                        backend=default_backend(),
                    )
                    encryptor = cipher.encryptor()
                    encrypted_chunk = encryptor.update(
                        chunk) + encryptor.finalize()
                    yield encrypted_chunk

        return generator()

    original_metadata = {
        "originalName": file_name,
        "originalSize": original_size,
        "originalType": original_mime,
    }

    return UploadPlan(
        filename=upload_filename,
        content_length=encrypted_size,
        mime_type=mime_type,
        is_encrypted=True,
        original_metadata=original_metadata,
        stream_factory=stream_factory,
    )


def handle_upload(args: argparse.Namespace) -> None:
    base_url = args.base_url.rstrip("/")

    if args.encrypt and args.encrypted:
        raise RuntimeError("--encrypt 옵션과 --encrypted 옵션은 동시에 사용할 수 없습니다.")

    credential_path = args.credential_file
    if not credential_path:
        credential_path = os.environ.get("SHAREIFY_CREDENTIAL_FILE")
    if not credential_path:
        default_path = os.path.join(os.path.dirname(__file__), ".credential")
        if os.path.exists(default_path):
            credential_path = default_path

    credentials = load_credentials(credential_path) if credential_path else {}

    if args.token:
        token = args.token
    else:
        email = args.email or credentials.get("EMAIL") or input("Email: ")
        password = args.password or credentials.get(
            "PASSWORD") or getpass.getpass("Password: ")
        two_factor = args.two_factor or credentials.get("TWO_FACTOR_CODE")
        if args.prompt_two_factor and not two_factor:
            two_factor = input("2FA code: ")
        use_backup_code = args.use_backup_code
        if credentials.get("USE_BACKUP_CODE"):
            value = credentials["USE_BACKUP_CODE"].lower()
            if value in {"1", "true", "yes", "y"}:
                use_backup_code = True
            elif value in {"0", "false", "no", "n"}:
                use_backup_code = False

        token = authenticate(base_url, email, password,
                             two_factor, use_backup_code)

    share_hash = args.share_hash.strip() if args.share_hash else None

    if args.encrypt:
        encryption_password = (
            args.encryption_password
            or credentials.get("ENCRYPTION_PASSWORD")
            or getpass.getpass("Encryption password: ")
        )
        plan = build_encryption_plan(
            args.file_path, encryption_password, args.mime)
    else:
        original_metadata = None
        mark_encrypted = args.encrypted
        if mark_encrypted:
            if (
                args.original_name is None
                or args.original_size is None
                or args.original_mime is None
            ):
                raise RuntimeError(
                    "이미 암호화된 파일을 업로드하려면 원본 이름, 크기, MIME 타입을 모두 제공해야 합니다."
                )
            original_metadata = {
                "originalName": args.original_name,
                "originalSize": args.original_size,
                "originalType": args.original_mime,
            }

        plan = build_plain_upload_plan(
            args.file_path,
            args.mime,
            is_encrypted=mark_encrypted,
            original_metadata=original_metadata,
        )

    upload_info = request_upload(
        base_url=base_url,
        token=token,
        filename=plan.filename,
        size=plan.content_length,
        mime_type=plan.mime_type,
        directory_id=args.directory_id,
        is_encrypted=plan.is_encrypted,
        original_metadata=plan.original_metadata,
        share_hash=share_hash,
    )

    perform_upload(upload_info["upload_url"], plan)

    finalize = finalize_upload(base_url, token, upload_info["file"]["id"])

    print("Upload completed:")
    print(json.dumps(finalize.get("file", {}), indent=2, ensure_ascii=False))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Shareify CLI helper")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("SHAREIFY_BASE_URL", "http://localhost:3000"),
        help="Base URL of the Shareify deployment (default: %(default)s)",
    )

    subparsers = parser.add_subparsers(dest="command")

    upload_parser = subparsers.add_parser(
        "upload", help="Authenticate and upload a file")
    upload_parser.add_argument("file_path", help="Path to the file to upload")
    upload_parser.add_argument(
        "--email", help="Account email (prompted if missing)")
    upload_parser.add_argument(
        "--password", help="Account password (prompted if missing)")
    upload_parser.add_argument(
        "--two-factor", help="2FA code to use during login")
    upload_parser.add_argument(
        "--prompt-two-factor",
        action="store_true",
        help="Prompt for a 2FA code interactively if not provided",
    )
    upload_parser.add_argument(
        "--use-backup-code",
        action="store_true",
        help="Treat the provided 2FA code as a backup code",
    )
    upload_parser.add_argument(
        "--credential-file",
        help="Path to a credential file containing EMAIL= and PASSWORD= entries",
    )
    upload_parser.add_argument(
        "--token", help="Existing JWT token to reuse instead of logging in")
    upload_parser.add_argument(
        "--directory-id", help="Optional target directory ID")
    upload_parser.add_argument(
        "--share-hash", help="Writable share link hash for shared directories")
    upload_parser.add_argument(
        "--mime", help="Override MIME type when uploading the file")
    upload_parser.add_argument(
        "--encrypt",
        action="store_true",
        help="Encrypt the file locally before uploading",
    )
    upload_parser.add_argument(
        "--encryption-password",
        help="Password to use for client-side encryption (prompted if missing)",
    )
    upload_parser.add_argument(
        "--encrypted",
        action="store_true",
        help="Treat the source file as already encrypted and supply original metadata manually",
    )
    upload_parser.add_argument(
        "--original-name", help="Original filename before encryption")
    upload_parser.add_argument(
        "--original-size",
        type=int,
        help="Original file size before encryption (bytes)",
    )
    upload_parser.add_argument(
        "--original-mime", help="Original MIME type before encryption")

    upload_parser.set_defaults(func=handle_upload)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    try:
        args.func(args)
    except KeyboardInterrupt:
        _print_error("Operation cancelled by user")
        sys.exit(1)
    except Exception as exc:  # pylint: disable=broad-except
        _print_error(str(exc))
        sys.exit(1)


if __name__ == "__main__":
    main()
