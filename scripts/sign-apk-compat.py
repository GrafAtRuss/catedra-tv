#!/usr/bin/env python3
"""JAR v1 signature named CERT.* plus APK Signature Scheme v2, no v3 and no verity padding."""
import hashlib
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

KS = "/workspace/android-tv/catedra.keystore"
ALIAS = "catedra"
STOREPASS = "catedra-tv"
SIG_ID = 0x7109871A
ALG = 0x0103


def u32(n: int) -> bytes:
    return struct.pack("<I", n)


def u64(n: int) -> bytes:
    return struct.pack("<Q", n)


def chunked_sha256(parts: list[bytes]) -> bytes:
    size = 1024 * 1024
    digests = []
    for part in parts:
        for i in range(0, len(part), size):
            chunk = part[i : i + size]
            digests.append(hashlib.sha256(b"\xa5" + u32(len(chunk)) + chunk).digest())
    return hashlib.sha256(b"\x5a" + u32(len(digests)) + b"".join(digests)).digest()


def find_eocd(data: bytes) -> int:
    pos = data.rfind(b"PK\x05\x06")
    if pos < 0:
        raise SystemExit("not a zip")
    return pos


def clear_zip_flags(data: bytearray) -> None:
    eocd = find_eocd(data)
    cd_off = struct.unpack_from("<I", data, eocd + 16)[0]
    cd_count = struct.unpack_from("<H", data, eocd + 10)[0]
    off = cd_off
    for _ in range(cd_count):
        if data[off : off + 4] != b"PK\x01\x02":
            raise SystemExit("bad central directory")
        flag = struct.unpack_from("<H", data, off + 8)[0] & ~0x0800
        struct.pack_into("<H", data, off + 8, flag)
        struct.pack_into("<H", data, off + 4, 20)  # version made by: DOS
        struct.pack_into("<I", data, off + 38, 0)  # no unix mode
        local = struct.unpack_from("<I", data, off + 42)[0]
        nlen = struct.unpack_from("<H", data, off + 28)[0]
        elen = struct.unpack_from("<H", data, off + 30)[0]
        clen = struct.unpack_from("<H", data, off + 32)[0]
        if data[local : local + 4] != b"PK\x03\x04":
            raise SystemExit("bad local header")
        lflag = struct.unpack_from("<H", data, local + 6)[0] & ~0x0800
        struct.pack_into("<H", data, local + 6, lflag)
        off += 46 + nlen + elen + clen


def export_key_and_cert() -> tuple[bytes, bytes, bytes]:
    from cryptography.hazmat.primitives.serialization import (
        Encoding,
        NoEncryption,
        PrivateFormat,
        PublicFormat,
        load_der_private_key,
        pkcs12,
    )

    raw = Path(KS).read_bytes()
    key, cert, _ = pkcs12.load_key_and_certificates(raw, STOREPASS.encode())
    cert_der = cert.public_bytes(Encoding.DER)
    pub_der = key.public_key().public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
    sig = key.sign(b"", None) if False else None
    del sig
    return key, cert_der, pub_der


def sign_digest_block(key, content: bytes) -> bytes:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding

    return key.sign(content, padding.PKCS1v15(), hashes.SHA256())


def build_v2_value(digest: bytes, cert_der: bytes, pub_der: bytes, signature: bytes) -> bytes:
    pairs = u32(40) + u32(ALG) + u32(32) + digest
    digests = u32(len(pairs)) + pairs
    certs_inner = u32(len(cert_der)) + cert_der
    certs = u32(len(certs_inner)) + certs_inner
    content = digests + certs + u32(0)
    sig_inner = u32(ALG) + u32(len(signature)) + signature
    sigs = u32(len(sig_inner)) + sig_inner
    pub = u32(len(pub_der)) + pub_der
    signer_body = u32(len(content)) + content + u32(len(sigs)) + sigs + pub
    signer = u32(len(signer_body)) + signer_body
    return u32(len(signer)) + signer


def insert_v2(data: bytearray, value: bytes) -> bytearray:
    eocd = find_eocd(data)
    cd_off = struct.unpack_from("<I", data, eocd + 16)[0]
    pair_len = 4 + len(value)
    size_field = 8 + pair_len + 8 + 16
    block = u64(size_field) + u64(pair_len) + u32(SIG_ID) + value + u64(size_field) + b"APK Sig Block 42"
    out = bytearray()
    out += data[:cd_off]
    out += block
    out += data[cd_off:eocd]
    new_eocd = bytearray(data[eocd:])
    struct.pack_into("<I", new_eocd, 16, cd_off + len(block))
    out += new_eocd
    return out


def jarsign(apk: Path) -> None:
    subprocess.check_call(
        [
            "jarsigner",
            "-sigalg",
            "SHA256withRSA",
            "-digestalg",
            "SHA-256",
            "-sigfile",
            "CERT",
            "-keystore",
            KS,
            "-storepass",
            STOREPASS,
            "-keypass",
            STOREPASS,
            str(apk),
            ALIAS,
        ]
    )


def main() -> None:
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    bt = "/workspace/.android-sdk/build-tools/34.0.0/zipalign"
    with tempfile.TemporaryDirectory() as tmp:
        signed = Path(tmp) / "v1.apk"
        aligned = Path(tmp) / "v1a.apk"
        signed.write_bytes(src.read_bytes())
        jarsign(signed)
        subprocess.check_call([bt, "-f", "4", str(signed), str(aligned)])
        raw = bytearray(aligned.read_bytes())
    clear_zip_flags(raw)
    eocd = find_eocd(raw)
    cd_off = struct.unpack_from("<I", raw, eocd + 16)[0]
    before = bytes(raw[:cd_off])
    cd = bytes(raw[cd_off:eocd])
    eocd_for_digest = bytearray(raw[eocd:])
    struct.pack_into("<I", eocd_for_digest, 16, cd_off)
    digest = chunked_sha256([before, cd, bytes(eocd_for_digest)])
    key, cert_der, pub_der = export_key_and_cert()
    # signature covers signed-data content; build it the same way as build_v2_value
    pairs = u32(40) + u32(ALG) + u32(32) + digest
    digests = u32(len(pairs)) + pairs
    certs_inner = u32(len(cert_der)) + cert_der
    certs = u32(len(certs_inner)) + certs_inner
    content = digests + certs + u32(0)
    signature = sign_digest_block(key, content)
    value = build_v2_value(digest, cert_der, pub_der, signature)
    out = insert_v2(raw, value)
    dst.write_bytes(out)
    print("wrote", dst, len(out))


if __name__ == "__main__":
    main()
