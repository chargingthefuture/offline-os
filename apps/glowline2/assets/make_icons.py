#!/usr/bin/env python3
"""Generate Glowline 2 app icons with no third-party libraries.

Draws the neon "dart" from the game — a right-pointing arrow — on the dark
Glowline field, with a soft glow and a horizontal track line. Writes square
PNGs sized for the web app icons and the iOS home-screen icon. Re-run this
after changing the look:  python3 assets/make_icons.py
"""
import struct, zlib, os

HERE = os.path.dirname(os.path.abspath(__file__))

BG = (5, 6, 13)          # page background
BG2 = (14, 18, 40)       # slightly lit top
TEAL = (56, 240, 208)    # ship / accent
PINK = (255, 77, 157)    # secondary accent


def blend(dst, src, a):
    return tuple(int(round(dst[i] * (1 - a) + src[i] * a)) for i in range(3))


def sign(ax, ay, bx, by, cx, cy):
    return (ax - cx) * (by - cy) - (bx - cx) * (ay - cy)


def in_tri(px, py, a, b, c):
    d1 = sign(px, py, a[0], a[1], b[0], b[1])
    d2 = sign(px, py, b[0], b[1], c[0], c[1])
    d3 = sign(px, py, c[0], c[1], a[0], a[1])
    neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    return not (neg and pos)


def dart(cx, cy, s, scale=1.0):
    # Right-pointing arrow, matching the in-game ship shape.
    r = s * 0.24 * scale
    return (
        (cx + r, cy),                 # tip
        (cx - r * 0.8, cy - r * 0.7), # top-back
        (cx - r * 0.8, cy + r * 0.7), # bottom-back
    )


def render(size):
    cx = cy = size / 2.0
    track_y = cy
    track_w = max(2.0, size * 0.016)
    core = dart(cx, cy, size, 1.0)
    glow = [dart(cx, cy, size, 1 + i * 0.5) for i in (3, 2, 1)]
    px = bytearray()
    for y in range(size):
        base = blend(BG, BG2, (1 - y / size) * 0.6)
        for x in range(size):
            col = base
            # horizontal track glow behind the dart
            dt = abs(y - track_y)
            if dt < track_w * 6:
                edge = min(1.0, min(x, size - x) / (size * 0.12))
                col = blend(col, PINK, max(0.0, 1 - dt / (track_w * 6)) ** 2 * 0.22 * edge)
            if dt < track_w:
                col = blend(col, PINK, 0.35)
            # dart glow rings, then the bright core
            for g in glow:
                if in_tri(x, y, *g):
                    col = blend(col, TEAL, 0.12)
                    break
            if in_tri(x, y, *core):
                col = blend((220, 255, 248), TEAL, 0.35)
            px += bytes(col) + b"\xff"
    return bytes(px)


def write_png(path, size):
    raw = render(size)
    stride = size * 4
    out = bytearray()
    for y in range(size):
        out.append(0)  # no per-row filter
        out += raw[y * stride:(y + 1) * stride]
    comp = zlib.compress(bytes(out), 9)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", comp)
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path, f"{size}x{size}", len(png), "bytes")


if __name__ == "__main__":
    write_png(os.path.join(HERE, "icon-192.png"), 192)
    write_png(os.path.join(HERE, "icon-512.png"), 512)
    write_png(os.path.join(HERE, "apple-touch-icon.png"), 180)
