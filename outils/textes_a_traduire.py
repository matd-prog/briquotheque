"""Liste les textes français affichés par index.html (nœuds de texte et attributs placeholder/title/aria-label/alt),
tels que js/langue.js les cherche dans les dictionnaires (espaces regroupés, sans espaces au bord).
Usage : python3 outils/textes_a_traduire.py > /tmp/textes.txt"""
import re, sys
from html.parser import HTMLParser

class Textes(HTMLParser):
    def __init__(self):
        super().__init__(); self.textes = []; self.ignore = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"): self.ignore += 1
        for k, v in attrs:
            if k in ("placeholder", "title", "aria-label", "alt") and v and re.search(r"[A-Za-zÀ-ÿ]{2}", v): self.textes.append(" ".join(v.split()))
    def handle_endtag(self, tag):
        if tag in ("script", "style"): self.ignore -= 1
    def handle_data(self, d):
        d = " ".join(d.split())
        if not self.ignore and re.search(r"[A-Za-zÀ-ÿ]{2}", d): self.textes.append(d)

t = Textes(); t.feed(open(sys.argv[1] if len(sys.argv) > 1 else "index.html", encoding="utf-8").read())
vus = []
for x in t.textes:
    if x not in vus: vus.append(x)
print("\n".join(vus))
