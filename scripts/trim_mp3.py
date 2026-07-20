#!/usr/bin/env python3
# Trim the first N seconds off an MP3 in place, then rebuild a Xing/VBR header so the
# duration reads correctly (and the file loops cleanly). Pure stdlib — no ffmpeg/sox.
#
# Used to permanently cut the ~19s intro off assets/music/backrooms-vol29.mp3 so the
# menu theme "starts at 0:20" without relying on seeking / server byte-range support.
#
#   python3 scripts/trim_mp3.py <file.mp3> <seconds-to-cut>   (default 19s)
#
# How it works: MP3 is a sequence of self-describing frames. We (1) skip any leading
# ID3v2 tag, (2) walk frames summing their durations until we pass the cut point and
# keep the stream from that frame on, then (3) prepend a fresh Xing header frame whose
# frame/byte counts describe the trimmed stream (so players don't mis-estimate length).
import sys

BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]   # MPEG1 L3 kbps
BR2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]       # MPEG2/2.5 L3
SR = {3: [44100, 48000, 32000, 0], 2: [22050, 24000, 16000, 0], 0: [11025, 12000, 8000, 0]}

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else 'assets/music/backrooms-vol29.mp3'
    cut = float(sys.argv[2]) if len(sys.argv) > 2 else 19.0
    d = bytearray(open(path, 'rb').read()); n = len(d)

    pos = 0
    if d[0:3] == b'ID3':
        pos = 10 + ((d[6] & 0x7f) << 21 | (d[7] & 0x7f) << 14 | (d[8] & 0x7f) << 7 | (d[9] & 0x7f))

    def hdr(o):
        if o + 4 > n or d[o] != 0xFF or (d[o + 1] & 0xE0) != 0xE0: return None
        ver = (d[o + 1] >> 3) & 3; layer = (d[o + 1] >> 1) & 3
        if layer != 1 or ver == 1: return None
        bri = (d[o + 2] >> 4) & 0xF; sri = (d[o + 2] >> 2) & 3; pad = (d[o + 2] >> 1) & 1
        br = (BR1 if ver == 3 else BR2)[bri]; sr = SR[ver][sri]
        if not br or not sr: return None
        br *= 1000
        flen = (144 * br // sr + pad) if ver == 3 else (72 * br // sr + pad)
        spf = 1152 if ver == 3 else 576
        return (flen, spf / sr, ver, sri, sr, spf, d[o + 1], d[o + 3]) if flen >= 4 else None

    # 1) walk to the cut point
    o = pos; elapsed = 0.0; cut_off = None
    while o < n:
        h = hdr(o)
        if h is None: o += 1; continue
        if elapsed >= cut: cut_off = o; break
        elapsed += h[1]; o += h[0]
    if cut_off is None: print('ERROR: never reached cut point'); sys.exit(1)
    body = bytes(d[cut_off:])

    # 2) count frames / duration in the kept body
    m = len(body); o = 0; frames = 0; first = None
    while o < m:
        h = hdr2(body, o)
        if h is None: break
        if first is None: first = h
        frames += 1; o += h[0]
    ver, sri, sr, spf, b1, b3 = first[2], first[3], first[4], first[5], first[6], first[7]

    # 3) build a Xing header frame (64 kbps so it's long enough to hold the tag)
    bri = 5 if ver == 3 else 8
    briv = (BR1 if ver == 3 else BR2)[bri] * 1000
    fl = (144 * briv // sr) if ver == 3 else (72 * briv // sr)
    mono = ((b3 >> 6) & 3) == 3
    side = (17 if mono else 32) if ver == 3 else (9 if mono else 17)
    fr = bytearray(fl)
    fr[0] = 0xFF; fr[1] = b1; fr[2] = (bri << 4) | (sri << 2); fr[3] = b3
    off = 4 + side
    fr[off:off + 4] = b'Xing'; fr[off + 4:off + 8] = (0x07).to_bytes(4, 'big')
    fr[off + 8:off + 12] = frames.to_bytes(4, 'big')
    fr[off + 12:off + 16] = (fl + m).to_bytes(4, 'big')
    fr[off + 16:off + 116] = bytes(min(255, i * 256 // 100) for i in range(100))

    open(path, 'wb').write(bytes(fr) + body)
    print(f'trimmed {elapsed:.2f}s; kept {frames} frames ({frames * spf / sr:.2f}s); +Xing header; size {fl + m}')

def hdr2(buf, o):
    n = len(buf)
    if o + 4 > n or buf[o] != 0xFF or (buf[o + 1] & 0xE0) != 0xE0: return None
    ver = (buf[o + 1] >> 3) & 3; layer = (buf[o + 1] >> 1) & 3
    if layer != 1 or ver == 1: return None
    bri = (buf[o + 2] >> 4) & 0xF; sri = (buf[o + 2] >> 2) & 3; pad = (buf[o + 2] >> 1) & 1
    br = (BR1 if ver == 3 else BR2)[bri]; sr = SR[ver][sri]
    if not br or not sr: return None
    br *= 1000
    flen = (144 * br // sr + pad) if ver == 3 else (72 * br // sr + pad)
    spf = 1152 if ver == 3 else 576
    return (flen, spf / sr, ver, sri, sr, spf, buf[o + 1], buf[o + 3]) if flen >= 4 else None

if __name__ == '__main__':
    main()
