"""Document intelligence: blur check, QR decode + signature check, ELA edit detection, CNIC structure, optional OCR.
All sample cards are SYNTHETIC and watermarked 'SAMPLE - MOCK'. Honest by design: when evidence is weak we say so."""
import hashlib
import hmac
import io
import json
import shutil
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .config import get_settings
from .identity import clean_cnic, validate_cnic, name_similarity

ISSUER_KEY = (get_settings().jwt_secret + "|mock-issuer").encode()


def sign_payload(p: dict) -> str:
    body = json.dumps({k: p[k] for k in sorted(p) if k != "sig"}, sort_keys=True, separators=(",", ":"))
    return hmac.new(ISSUER_KEY, body.encode(), hashlib.sha256).hexdigest()[:16]


# ---------------- sample card generator (for demos + tests) ----------------------
def make_sample_card(name: str, father: str, cnic: str, dob: str, district: str, *, forged: bool = False,
                     blur: bool = False, bad_sig: bool = False) -> bytes:
    import qrcode
    W, H = 856, 540
    img = Image.new("RGB", (W, H), (226, 240, 226))
    d = ImageDraw.Draw(img)
    try:
        f1 = ImageFont.truetype("arial.ttf", 30)
        f2 = ImageFont.truetype("arial.ttf", 24)
        f3 = ImageFont.truetype("arialbd.ttf", 40)
    except Exception:
        f1 = f2 = f3 = ImageFont.load_default()
    d.rectangle([0, 0, W, 70], fill=(24, 94, 56))
    d.text((24, 18), "SAMPLE - MOCK IDENTITY CARD (NOT REAL)", fill=(255, 255, 255), font=f1)
    d.text((24, 100), f"Name: {name}", fill=(0, 0, 0), font=f1)
    d.text((24, 150), f"Father: {father}", fill=(0, 0, 0), font=f1)
    d.text((24, 200), f"DOB: {dob}", fill=(0, 0, 0), font=f2)
    d.text((24, 240), f"District: {district}", fill=(0, 0, 0), font=f2)
    shown = cnic[:-1] + ("2" if cnic[-1] != "2" else "4") if forged else cnic  # forger edits the printed number
    d.text((24, 400), shown, fill=(0, 0, 0), font=f3)
    payload = {"cnic": clean_cnic(shown if forged else cnic), "name": name, "dob": dob}
    payload["sig"] = "deadbeefdeadbeef" if (bad_sig or forged) else sign_payload(payload)  # forger cannot sign
    qr = qrcode.make(json.dumps(payload, separators=(",", ":"))).convert("RGB").resize((260, 260))
    img.paste(qr, (560, 150))
    d.text((24, 500), "PROTOTYPE SAMPLE - synthetic data", fill=(120, 0, 0), font=f2)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=92)
    data = buf.getvalue()
    if blur:
        arr = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        arr = cv2.GaussianBlur(arr, (0, 0), 6)
        ok, enc = cv2.imencode(".jpg", arr, [cv2.IMWRITE_JPEG_QUALITY, 85])
        data = enc.tobytes()
    return data


# ---------------- analysis --------------------------------------------------------
def _blur_score(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _ela(img_bgr: np.ndarray, quality: int = 90) -> dict:
    ok, enc = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    re = cv2.imdecode(enc, cv2.IMREAD_COLOR)
    diff = cv2.absdiff(img_bgr, re).astype(np.float32).mean(axis=2)
    h, w = diff.shape
    gh, gw = 8, 8
    cells = np.array([diff[i * h // gh:(i + 1) * h // gh, j * w // gw:(j + 1) * w // gw].mean()
                      for i in range(gh) for j in range(gw)])
    med = float(np.median(cells)) + 1e-6
    ratio = float(cells.max() / med)
    return {"max_cell": round(float(cells.max()), 3), "median_cell": round(med, 3), "ratio": round(ratio, 2)}


def _decode_qr(img_bgr: np.ndarray) -> str | None:
    det = cv2.QRCodeDetector()
    val, _, _ = det.detectAndDecode(img_bgr)
    if val:
        return val
    big = cv2.resize(img_bgr, None, fx=1.5, fy=1.5)
    val, _, _ = det.detectAndDecode(big)
    return val or None


def ocr_available() -> bool:
    return shutil.which("tesseract") is not None


def _ocr_cnic(img_bgr: np.ndarray) -> dict:
    """Best-effort OCR of the printed 13-digit number. OCR is error-prone (it once read 345 as 848), so it is a WEAK signal:
    several preprocessing variants are tried and every 13-digit candidate is returned."""
    if not ocr_available():
        return {"available": False, "note": "OCR engine not installed on this server; relying on QR + form cross-check."}
    try:
        import pytesseract, re
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        big = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        _, otsu = cv2.threshold(big, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        cands: list[str] = []
        for variant in (otsu, big):
            for cfg in ("--psm 6 -c tessedit_char_whitelist=0123456789-", "--psm 11 -c tessedit_char_whitelist=0123456789-"):
                txt = pytesseract.image_to_string(Image.fromarray(variant), config=cfg)
                for m in re.finditer(r"(\d{5})\D?(\d{7})\D?(\d)", txt):
                    c = "".join(m.groups())
                    if c not in cands:
                        cands.append(c)
        return {"available": True, "candidates": cands, "cnic": cands[0] if cands else None}
    except Exception as e:  # noqa
        return {"available": False, "note": f"OCR failed: {type(e).__name__}"}


def analyze_document(data: bytes, claimed: dict | None = None) -> dict:
    """Returns authenticity 0..1, flag in {None,'blurry','forged','mismatch','unreadable'}, human-readable flags."""
    claimed = claimed or {}
    flags: list[str] = []
    try:
        arr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("not an image")
    except Exception:
        return {"authenticity": None, "flag": "unreadable", "flags": ["File is not a readable image."], "quality": {}}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    blur = _blur_score(gray)
    quality = {"width": w, "height": h, "sharpness": round(blur, 1), "blurry": blur < 120}
    qr_raw = _decode_qr(img)
    qr: dict[str, Any] = {"found": bool(qr_raw)}
    ela = _ela(img)
    ocr = _ocr_cnic(img)
    score = 1.0
    flag = None

    if min(h, w) < 300:
        flags.append("Image resolution is very low.")
        score -= 0.2
    if quality["blurry"]:
        flags.append("Photo is blurry; details cannot be trusted. Please retake it.")
        score -= 0.35
        flag = "blurry"

    # QR: signature + cross-check with what was typed in the form
    if qr_raw:
        try:
            p = json.loads(qr_raw)
            sig_ok = hmac.compare_digest(str(p.get("sig", "")), sign_payload(p))
            qr.update({"signature_valid": sig_ok, "payload": {k: v for k, v in p.items() if k != "sig"}})
            if not sig_ok:
                flags.append("QR code signature is INVALID: the card data was altered or the QR was not issued by the (mock) authority.")
                score -= 0.6
                flag = "forged"
            c_claim = clean_cnic(claimed.get("cnic"))
            if c_claim and p.get("cnic") and c_claim != p["cnic"]:
                flags.append("CNIC on the card QR differs from the CNIC typed in the form.")
                score -= 0.45
                flag = flag or "mismatch"
            if claimed.get("name") and p.get("name"):
                lvl = name_similarity(claimed["name"], p["name"])["level"]
                qr["name_match"] = lvl
                if lvl in ("none",):
                    flags.append("Name on the card QR does not match the name in the form.")
                    score -= 0.35
                    flag = flag or "mismatch"
        except Exception:
            flags.append("QR code is present but unreadable/corrupted.")
            score -= 0.25
    else:
        flags.append("No QR code could be read from the card.")
        score -= 0.15

    # ELA: edit/splice indicator (heuristic, labelled as such)
    ela["suspicious"] = False  # informational only: ELA is unreliable on flat graphics, so it never blocks anyone on its own
    ela["note"] = "Error-level analysis shown for the reviewer; not used to block (too many false alarms on clean cards)."

    # OCR cross-check (when engine installed). A weak signal: it can only RAISE a mismatch when the signed QR does not already
    # vouch for the number typed in the form. Otherwise a disagreement is treated as an OCR read error and noted for the reviewer.
    typed = clean_cnic(claimed.get("cnic"))
    qr_vouches = bool(qr.get("signature_valid")) and typed and (qr.get("payload") or {}).get("cnic") == typed
    if ocr.get("available") and typed and ocr.get("candidates") is not None:
        cands = ocr.get("candidates") or []
        if typed in cands:
            ocr["confirms_form"] = True
        elif cands:
            ocr["confirms_form"] = False
            if qr_vouches:
                flags.append(f"OCR read the printed number as {cands[0]}, which differs from the form, but the signed QR matches the form, so this is treated as an OCR read error.")
                score -= 0.02
            else:
                flags.append("Printed CNIC (OCR) differs from the CNIC typed in the form, and no valid QR backs the form.")
                score -= 0.4
                flag = flag or "mismatch"
    v = validate_cnic(claimed.get("cnic"), claimed.get("gender"))
    if not v["valid"]:
        flags.append("CNIC number is structurally invalid: " + "; ".join(v["issues"]))
        score -= 0.25

    score = max(0.0, min(1.0, score))
    return {"authenticity": round(score, 3), "flag": flag, "flags": flags, "quality": quality, "qr": qr,
            "ela": ela, "ocr": ocr, "heuristic_notice": "Forgery signals are heuristics; borderline cases go to a human."}
