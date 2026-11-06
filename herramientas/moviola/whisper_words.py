"""Transcribe un audio/video con faster-whisper y guarda las palabras con sus tiempos (JSON).

Uso: python whisper_words.py <entrada> <salida.json> [modelo] [idioma]
Corre 100 % en este ordenador: el video no se sube a ningún servicio.
"""
import json
import sys

from faster_whisper import WhisperModel

entrada, salida = sys.argv[1], sys.argv[2]
modelo = sys.argv[3] if len(sys.argv) > 3 else "small"
idioma = sys.argv[4] if len(sys.argv) > 4 else "es"

m = WhisperModel(modelo, device="cpu", compute_type="int8")
segmentos, info = m.transcribe(entrada, language=idioma, word_timestamps=True, vad_filter=True)

palabras = []
for s in segmentos:
    for w in s.words or []:
        palabras.append({"palabra": w.word.strip(), "inicio": round(w.start, 2), "fin": round(w.end, 2)})

with open(salida, "w", encoding="utf-8") as f:
    json.dump({"idioma": info.language, "duracion": round(info.duration, 2), "modelo": modelo, "palabras": palabras}, f, ensure_ascii=False)
print(json.dumps({"palabras": len(palabras), "duracion": round(info.duration, 2)}))
