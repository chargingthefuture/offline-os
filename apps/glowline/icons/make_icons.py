#!/usr/bin/env python3
"""Generate Glowline PWA icons (no third-party deps).

Draws the neon "courier" rhombus from the game on a dark Core-blue field,
with a soft glow and a glowing track line. Emits maskable-safe square PNGs.
"""
import struct, zlib, math, os

HERE = os.path.dirname(os.path.abspath(__file__))

BG = (13, 13, 31)          # Core background (matches game)
NEON = (0, 255, 204)       # GL-1N3 teal
NEON2 = (120, 90, 255)     # Pulse violet accent


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def blend(dst, src, alpha):
    return tuple(int(round(dst[i] * (1 - alpha) + src[i] * alpha)) for i in range(3))


def point_in_diamond(px, py, cx, cy, rx, ry):
    if rx == 0 or ry == 0:
        return False
    return abs(px - cx) / rx + abs(py - cy) / ry <= 1.0


def render(size):
    cx = cy = size / 2.0
    px = bytearray()
    ship_rx = size * 0.20
    ship_ry = size * 0.30
    # vertical neon track line behind the ship
    track_x = cx
    track_w = max(2.0, size * 0.018)
    for y in range(size):
        # subtle vertical gradient on the background
        t = y / size
        base = blend(BG, (20, 18, 42), t * 0.6)
        for x in range(size):
            col = base
            # track glow
            d_track = abs(x - track_x)
            if d_track < track_w * 6:
                a = max(0.0, 1.0 - d_track / (track_w * 6)) ** 2
                # fade track near top/bottom edges
                edge = min(1.0, min(y, size - y) / (size * 0.12))
                col = blend(col, NEON2, a * 0.28 * edge)
            if d_track < track_w:
                col = blend(col, NEON2, 0.5)
            # ship outer glow (a few expanding diamonds)
            for i in (3, 2, 1):
                if point_in_diamond(x, y, cx, cy, ship_rx * (1 + i * 0.45),
                                    ship_ry * (1 + i * 0.45)):
                    col = blend(col, NEON, 0.10)
                    break
            # ship core
            if point_in_diamond(x, y, cx, cy, ship_rx, ship_ry):
                # brighter toward center
                dd = abs(x - cx) / ship_rx + abs(y - cy) / ship_ry
                col = blend(lerp(NEON, (235, 255, 250), 0.4), NEON, dd)
            px += bytes(col) + b"\xff"
    return bytes(px)


def write_png(path, size):
    raw = render(size)
    # add filter byte (0) at the start of every row
    stride = size * 4
    out = bytearray()
    for y in range(size):
        out.append(0)
        out += raw[y * stride:(y + 1) * stride]
    comp = zlib.compress(bytes(out), 9)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", comp) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path, size, "x", size, len(png), "bytes")


if __name__ == "__main__":
    write_png(os.path.join(HERE, "icon-192.png"), 192)
    write_png(os.path.join(HERE, "icon-512.png"), 512)
    write_png(os.path.join(HERE, "apple-touch-icon.png"), 180)
