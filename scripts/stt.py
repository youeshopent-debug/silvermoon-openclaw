"""
faster-whisper speech-to-text via stdin/stdout JSON protocol.
Input:  {"audio": "path", "language": "zh"}  (language optional, auto-detect if null)
Output: {"text": "...", "segments": [...], "ok": true}
"""
import sys
import json
from faster_whisper import WhisperModel

MODEL_SIZE = "large-v3"
model = None

def get_model():
    global model
    if model is None:
        model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
    return model

def transcribe(audio_path, language=None):
    model = get_model()
    segments, info = model.transcribe(audio_path, language=language, beam_size=5)
    result = []
    full_text = ""
    for seg in segments:
        result.append({
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": seg.text.strip(),
        })
        full_text += seg.text
    return {
        "ok": True,
        "text": full_text.strip(),
        "segments": result,
        "language": info.language,
        "duration": round(info.duration, 2),
    }

if __name__ == "__main__":
    raw = sys.stdin.buffer.read().decode("utf-8-sig")
    try:
        params = json.loads(raw)
        result = transcribe(params["audio"], params.get("language"))
    except Exception as e:
        result = {"ok": False, "error": str(e)}
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
    sys.stdout.buffer.flush()
