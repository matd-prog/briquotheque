"""Montage de la vidéo de présentation : début et fin du film, temps d'attente coupés, MP4 (H.264) lisible partout.
Usage : python3 monter.py <dossier> fr   (lit video_fr.webm et video_fr.json, écrit Briquotheque_presentation_fr.mp4)"""
import json, subprocess, sys
import imageio_ffmpeg
d, L = sys.argv[1], sys.argv[2]
m = json.load(open(f"{d}/video_{L}.json"))
garde = []
t = m["debut"]
for a, b in m["coupes"]:
    garde.append((t, a)); t = b
garde.append((t, m["fin"]))
expr = "+".join(f"between(t,{a:.2f},{b:.2f})" for a, b in garde)
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", f"{d}/video_{L}.webm",
                "-vf", f"fps=30,select='{expr}',setpts=N/30/TB", "-c:v", "libx264", "-preset", "slow", "-crf", "20",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{d}/Briquotheque_presentation_{L}.mp4"], check=True)
print(L, "gardé :", round(sum(b - a for a, b in garde), 1), "s")
