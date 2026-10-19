"""Montage de la vidéo de présentation : début et fin du film, temps d'attente coupés, agrandie au format d'un téléphone
(1080 × 2400, l'écran entier), son (voix off, musique de fond baissée pendant la voix, clic à chaque bouton touché),
MP4 (H.264 + AAC) lisible partout.
Usage : python3 monter.py durees               (durée de chaque phrase de voix off, avant de filmer)
        python3 monter.py <dossier> fr          (lit video_fr.webm et video_fr.json, écrit Briquotheque_presentation_fr.mp4)"""
import json, os, re, subprocess, sys, wave
import numpy as np
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
ICI = os.path.dirname(os.path.abspath(__file__))
VOIX = "/home/user/collection-lego-prive/presentation/voix/"

def duree(f):
    sortie = subprocess.run([FF, "-i", f], capture_output=True, text=True).stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", sortie).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)

if sys.argv[1] == "durees":
    d = {}
    for f in sorted(os.listdir(VOIX)):
        if f.endswith(".mp3"):
            langue, cle = f[:-4].split("_", 1)
            d.setdefault(langue, {})[cle] = round(duree(VOIX + f), 2)
    json.dump(d, open(VOIX + "durees.json", "w"), indent=1)
    print({k: round(sum(v.values()), 1) for k, v in d.items()}, "s de voix")
    sys.exit()

d, L = sys.argv[1], sys.argv[2]
m = json.load(open(f"{d}/video_{L}.json"))
garde, t = [], m["debut"]
for a, b in m["coupes"]:
    garde.append((t, a)); t = b
garde.append((t, m["fin"]))
total = sum(b - a for a, b in garde)

def place(t):
    """Instant du film monté correspondant à l'instant t de l'enregistrement (début d'une coupe -> son début)."""
    x = 0.0
    for a, b in garde:
        if t < a: return x
        if t <= b: return x + t - a
        x += b - a
    return x

# clic : petit son bref et doux
SR = 44100
tc = np.arange(int(.06 * SR)) / SR
clic = (np.sin(2 * np.pi * 1900 * tc) * .5 + np.sin(2 * np.pi * 950 * tc) * .5) * np.exp(-tc * 90)
with wave.open(f"{d}/clic.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((clic * .6 * 32767).astype("<i2").tobytes())
subprocess.run(["python3", f"{ICI}/musique.py", str(total + 1), f"{d}/musique.wav"], check=True, capture_output=True)

entrees = ["-i", f"{d}/video_{L}.webm", "-i", f"{d}/musique.wav"]
filtres, voix, clics = [], [], []
k = 2
for s in m.get("sons", []):
    ms = int(place(s["t"]) * 1000)
    if "voix" in s:
        entrees += ["-i", f"{VOIX}{L}_{s['voix']}.mp3"]
        filtres.append(f"[{k}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={ms}|{ms},volume=1.6[v{k}]"); voix.append(f"[v{k}]")
    else:
        entrees += ["-i", f"{d}/clic.wav"]
        filtres.append(f"[{k}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={ms}|{ms},volume=.5[c{k}]"); clics.append(f"[c{k}]")
    k += 1
expr = "+".join(f"between(t,{a:.2f},{b:.2f})" for a, b in garde)
filtres.insert(0, f"[0:v]fps=30,select='{expr}',setpts=N/30/TB,scale=1080:2400:flags=lanczos,setsar=1[vid]")
filtres.append(f"{''.join(voix)}amix=inputs={len(voix)}:normalize=0,asplit=2[voixa][voixb]")
# musique baissée pendant que la voix parle (compression déclenchée par la voix)
filtres.append("[1:a]volume=.16[mus]")
filtres.append("[mus][voixb]sidechaincompress=threshold=0.02:ratio=8:attack=40:release=500[musb]")
filtres.append(f"[voixa][musb]{''.join(clics)}amix=inputs={2 + len(clics)}:normalize=0,alimiter=limit=0.95[son]")
subprocess.run([FF, "-y", "-loglevel", "error", *entrees, "-filter_complex", ";".join(filtres), "-map", "[vid]", "-map", "[son]",
                "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
                "-t", f"{total:.2f}", "-movflags", "+faststart", f"{d}/Briquotheque_presentation_{L}.mp4"], check=True)
print(L, "gardé :", round(total, 1), "s,", len(voix), "phrases,", len(clics), "clics")
