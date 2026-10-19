"""Musique de fond de la vidéo de présentation, composée par programme (aucun droit d'auteur) : nappe douce, arpèges et
basse sur quatre accords (do, la mineur, fa, sol), 84 battements par minute, fondu au début et à la fin.
Usage : python3 musique.py <durée en secondes> <sortie.wav>"""
import sys, wave
import numpy as np

SR = 44100
duree = float(sys.argv[1]) if len(sys.argv) > 1 else 70
sortie = sys.argv[2] if len(sys.argv) > 2 else "musique.wav"
n = int(SR * duree)
g, d = np.zeros(n), np.zeros(n)  # canaux gauche et droit

def note(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)

def ajouter(signal, debut, gain_g, gain_d):
    i = int(debut * SR)
    if i >= n: return
    s = signal[: n - i]
    g[i:i + len(s)] += s * gain_g
    d[i:i + len(s)] += s * gain_d

def nappe(f, longueur):
    t = np.arange(int(longueur * SR)) / SR
    son = sum(np.sin(2 * np.pi * f * k * t * (1 + dt)) / k ** 1.6 for k, dt in [(1, 0), (2, .0007), (3, -.0005), (4, 0)])
    env = np.minimum(1, t / 0.9) * np.minimum(1, (longueur - t) / 1.2)
    return son * env

def pincee(f, longueur=1.4):
    t = np.arange(int(longueur * SR)) / SR
    son = np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * 2 * f * t) + .12 * np.sin(2 * np.pi * 3 * f * t)
    return son * np.exp(-t * 3.2) * np.minimum(1, t / .006)

def basse(f, longueur):
    t = np.arange(int(longueur * SR)) / SR
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 1.1) * np.minimum(1, t / .02)

bpm = 84
temps = 60 / bpm
mesure = 4 * temps
# do maj7, la m7, fa maj7, sol (sus puis majeur)
accords = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]]
basses = [36, 33, 29, 31]
arpege = [0, 2, 1, 3, 2, 1, 3, 2]
t0, k = 0.0, 0
while t0 < duree:
    a = accords[k % 4]
    for m in a:
        ajouter(nappe(note(m), mesure + 1.0) * .05, t0, .9, 1.0)
    ajouter(basse(note(basses[k % 4]), mesure) * .16, t0, 1, 1)
    ajouter(basse(note(basses[k % 4]), mesure / 2) * .10, t0 + 2 * temps, 1, 1)
    for j, i in enumerate(arpege):
        m = a[i] + 12
        ajouter(pincee(note(m)) * .07, t0 + j * temps / 2, 1.0 if j % 2 else .6, .6 if j % 2 else 1.0)
    t0 += mesure
    k += 1

# fondus et normalisation douce
t = np.arange(n) / SR
fondu = np.minimum(1, t / 2.0) * np.minimum(1, (duree - t) / 3.0)
st = np.stack([g * fondu, d * fondu], axis=1)
st = st / np.max(np.abs(st)) * 0.8
with wave.open(sortie, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())
print(sortie, round(duree, 1), "s")
