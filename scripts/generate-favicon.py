#!/usr/bin/env python3
"""生成 16x16 favicon.ico（主题色 #42b983）。"""

import struct
from pathlib import Path

SIZE = 16
COLOR = (0x83, 0xB9, 0x42, 0xFF)  # BGRA
TRANSPARENT = (0, 0, 0, 0)


def make_pixels():
    pixels = []
    cx, cy, r = 7.5, 7.5, 6.5
    for y in range(SIZE):
        row = []
        for x in range(SIZE):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                row.append(COLOR)
            else:
                row.append(TRANSPARENT)
        pixels.append(row)
    return pixels


def bmp_data(pixels):
    header = struct.pack("<IIIHHIIIIII", 40, SIZE, SIZE * 2, 1, 32, 0, 0, 0, 0, 0, 0)
    buf = bytearray(header)
    for row in reversed(pixels):
        for b, g, r, a in row:
            buf.extend((b, g, r, a))
        pad = (4 - (SIZE * 4) % 4) % 4
        buf.extend(b"\x00" * pad)
    return bytes(buf)


def ico_bytes(pixels):
    image = bmp_data(pixels)
    entry = struct.pack("<BBBBHHII", SIZE, SIZE, 0, 0, 1, 32, len(image), 22)
    header = struct.pack("<HHH", 0, 1, 1)
    return header + entry + image


def main():
    out = Path("assets/favicon.ico")
    out.write_bytes(ico_bytes(make_pixels()))
    print(f"Generated {out}")


if __name__ == "__main__":
    main()
