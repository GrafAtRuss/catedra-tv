#!/usr/bin/env python3
"""Tiny static launchers: exec /usr/bin/sailfish-qml ru.catedra.Catedra."""
import struct
from pathlib import Path

PATH = b"/usr/bin/sailfish-qml\0"
NAME = b"ru.catedra.Catedra\0"
OUT = Path("/workspace/aurora/launchers")
LOAD = 0x10000
CODE_OFF = 0x1000
CODE_VA = LOAD + CODE_OFF


def u16(n):
    return struct.pack("<H", n)


def u32(n):
    return struct.pack("<I", n)


def u64(n):
    return struct.pack("<Q", n)


def layout(align):
    path_off = 32
    name_off = path_off + len(PATH)
    argv_off = (name_off + len(NAME) + (align - 1)) & ~(align - 1)
    return path_off, name_off, argv_off


def payload(code, align, pack):
    path_off, name_off, argv_off = layout(align)
    data = bytearray(code)
    if len(data) > path_off:
        raise SystemExit("code longer than string slot")
    data.extend(b"\0" * (path_off - len(data)))
    data.extend(PATH)
    data.extend(NAME)
    while len(data) < argv_off:
        data.append(0)
    data += pack(CODE_VA + path_off)
    data += pack(CODE_VA + name_off)
    data += pack(0)
    return data, path_off, name_off, argv_off


def arm32():
    path_off, name_off, argv_off = layout(4)
    imm_path = path_off - (4 + 8)
    imm_argv = argv_off - (8 + 8)
    code = b"".join([
        u32(0xE3A0700B),
        u32(0xE28F0000 | imm_path),
        u32(0xE28F1000 | imm_argv),
        u32(0xE3A02000),
        u32(0xEF000000),
        u32(0xE3A0007F),
        u32(0xE3A07001),
        u32(0xEF000000),
    ])
    data, _, _, _ = payload(code, 4, u32)
    ehdr = bytearray(52)
    ehdr[0:4] = b"\x7fELF"
    ehdr[4] = 1  # ELFCLASS32
    ehdr[5] = 1  # LSB
    ehdr[6] = 1
    ehdr[16:18] = u16(2)  # ET_EXEC
    ehdr[18:20] = u16(40)  # EM_ARM
    ehdr[20:24] = u32(1)
    ehdr[24:28] = u32(CODE_VA)
    ehdr[28:32] = u32(52)  # phoff
    ehdr[36:38] = u16(52)  # ehsize
    ehdr[40:42] = u16(32)  # phentsize
    ehdr[42:44] = u16(1)
    ehdr[36:40] = u32((52 << 16) | 52) if False else ehdr[36:40]
    # flags at 36 is e_flags, ehsize starts at 40. Reset properly.
    ehdr[36:40] = u32(0x05000400)  # EABI v5 + hard float
    ehdr[40:42] = u16(52)
    ehdr[42:44] = u16(32)
    ehdr[44:46] = u16(1)
    filesz = CODE_OFF + len(data)
    ph = b"".join([
        u32(1),          # PT_LOAD
        u32(0),          # offset
        u32(LOAD),
        u32(LOAD),
        u32(filesz),
        u32(filesz),
        u32(5),          # R+X
        u32(0x1000),
    ])
    file = bytearray(filesz)
    file[0:52] = ehdr
    file[52:84] = ph
    file[CODE_OFF:CODE_OFF + len(data)] = data
    return bytes(file)


def adr64(rd, imm):
    immlo = imm & 3
    immhi = (imm >> 2) & 0x7FFFF
    return (immlo << 29) | (0x10 << 24) | (immhi << 5) | rd


def arm64():
    path_off, name_off, argv_off = layout(8)
    code = b"".join([
        u32(adr64(0, path_off)),
        u32(adr64(1, argv_off - 4)),
        u32(0xD2800002),
        u32(0xD2800000 | (221 << 5) | 8),
        u32(0xD4000001),
        u32(0xD2800000 | (127 << 5)),
        u32(0xD2800000 | (93 << 5) | 8),
        u32(0xD4000001),
    ])
    data, _, _, _ = payload(code, 8, u64)
    ehdr = bytearray(64)
    ehdr[0:4] = b"\x7fELF"
    ehdr[4] = 2
    ehdr[5] = 1
    ehdr[6] = 1
    ehdr[16:18] = u16(2)
    ehdr[18:20] = u16(183)  # EM_AARCH64
    ehdr[20:24] = u32(1)
    ehdr[24:32] = u64(CODE_VA)
    ehdr[32:40] = u64(64)  # phoff
    ehdr[52:54] = u16(64)
    ehdr[54:56] = u16(56)
    ehdr[56:58] = u16(1)
    filesz = CODE_OFF + len(data)
    ph = b"".join([
        u32(1),
        u32(5),
        u64(0),
        u64(LOAD),
        u64(LOAD),
        u64(filesz),
        u64(filesz),
        u64(0x1000),
    ])
    file = bytearray(filesz)
    file[0:64] = ehdr
    file[64:120] = ph
    file[CODE_OFF:CODE_OFF + len(data)] = data
    return bytes(file)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "launcher.armv7hl").write_bytes(arm32())
    (OUT / "launcher.aarch64").write_bytes(arm64())
    for name in ("launcher.armv7hl", "launcher.aarch64"):
        print(name, (OUT / name).stat().st_size)


if __name__ == "__main__":
    main()
