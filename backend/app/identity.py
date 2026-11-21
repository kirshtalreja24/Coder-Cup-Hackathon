"""Bad-data-proof identity matching.
- CNIC structural validation (13 digits; first digit = province; last digit odd=male / even=female)
- Name canonicalisation (Muhammad/Mohammad/Muhammed...), Urdu-script transliteration, phonetic key
- Fellegi-Sunter probabilistic linkage with THREE outcomes: MATCH / POSSIBLE (human) / NON_MATCH.
  Missing fields contribute 0 weight, so a record with missing data can never auto-MATCH on thin evidence.
"""
import math
import re
import unicodedata
from typing import Any

from rapidfuzz import fuzz
from rapidfuzz.distance import JaroWinkler

PROVINCES = {"1": "Khyber Pakhtunkhwa", "2": "FATA/KP", "3": "Punjab", "4": "Sindh", "5": "Balochistan",
             "6": "Islamabad", "7": "Gilgit-Baltistan", "8": "Azad Kashmir"}

# ---------- CNIC ----------------------------------------------------------------
def clean_cnic(raw: Any) -> str | None:
    if raw is None:
        return None
    digits = re.sub(r"\D", "", str(raw))
    return digits or None


def format_cnic(d: str) -> str:
    return f"{d[:5]}-{d[5:12]}-{d[12]}" if len(d) == 13 else d


def validate_cnic(raw: Any, gender: str | None = None) -> dict:
    d = clean_cnic(raw)
    issues: list[str] = []
    if not d:
        return {"valid": False, "cnic": None, "issues": ["missing"], "province": None}
    if len(d) != 13:
        issues.append(f"must be 13 digits (got {len(d)})")
    if d and d[0] not in PROVINCES:
        issues.append("first digit is not a valid province code")
    if len(d) == 13 and gender in ("M", "F"):
        male = int(d[-1]) % 2 == 1
        if male != (gender == "M"):
            issues.append("last digit parity does not match stated gender")
    return {"valid": not issues, "cnic": d, "issues": issues, "province": PROVINCES.get(d[0]) if d else None}


# ---------- Names ---------------------------------------------------------------
_URDU = {"ا": "a", "آ": "aa", "ب": "b", "پ": "p", "ت": "t", "ٹ": "t", "ث": "s", "ج": "j", "چ": "ch", "ح": "h",
         "خ": "kh", "د": "d", "ڈ": "d", "ذ": "z", "ر": "r", "ڑ": "r", "ز": "z", "ژ": "zh", "س": "s", "ش": "sh",
         "ص": "s", "ض": "z", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "q", "ک": "k", "گ": "g",
         "ل": "l", "م": "m", "ن": "n", "ں": "n", "و": "w", "ہ": "h", "ھ": "h", "ء": "", "ی": "i", "ے": "e", "ئ": "i",
         "ۃ": "h", "ك": "k", "ي": "i", "ى": "i", "ه": "h"}
_URDU_WORDS = {"محمد": "muhammad", "احمد": "ahmad", "علی": "ali", "بی بی": "bibi", "بی": "bibi", "فاطمہ": "fatima",
               "حسین": "hussain", "حسن": "hasan", "عبدالرحمن": "abdul rehman", "خان": "khan", "شاہ": "shah"}

_CANON = {
    "muhammad": ["mohammad", "mohammed", "muhammed", "muhammad", "mohamad", "muhamad", "mohd", "muhd", "md", "mohamed",
                 "mohamud", "muhammed", "mhd", "mohmmad", "muhamed", "mahmmad"],
    "ahmad": ["ahmed", "ahmad", "ahmet", "ahmud"],
    "hussain": ["hussain", "hussein", "husain", "hosain", "hussan"],
    "hasan": ["hasan", "hassan", "hasaan"],
    "abdul": ["abdul", "abdel", "abdal", "abd"],
    "rehman": ["rehman", "rahman", "rehmaan", "rahmaan"],
    "fatima": ["fatima", "fatimah", "fatema", "fatma"],
    "bibi": ["bibi", "bibee", "bebe", "bibbi"],
    "khan": ["khan", "khaan"],
    "ali": ["ali", "aly"],
    "shah": ["shah", "shaah"],
    "iqbal": ["iqbal", "ikbal"],
    "usman": ["usman", "osman", "uthman"],
    "yousuf": ["yousuf", "yusuf", "yousaf", "yusuf", "joseph"],
    "ibrahim": ["ibrahim", "ibraheem", "ebrahim"],
    "ayesha": ["ayesha", "aisha", "ayisha", "aysha", "aaisha"],
    "zainab": ["zainab", "zaynab", "zeinab", "zenab"],
}
_CANON_LOOKUP = {v: k for k, vs in _CANON.items() for v in vs}
_STOP = {"mr", "mrs", "ms", "late", "s/o", "d/o", "w/o", "so", "do", "wo", "bint", "bin", "ibn", "son", "of"}


def transliterate(s: str) -> str:
    for w, r in _URDU_WORDS.items():
        s = s.replace(w, f" {r} ")
    return "".join(_URDU.get(ch, ch) for ch in s)


def name_tokens(s: Any) -> list[str]:
    if not s or not isinstance(s, str):
        return []
    s = transliterate(s)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z\s]", " ", s)
    toks = [t for t in s.split() if t and t not in _STOP]
    return [_CANON_LOOKUP.get(t, t) for t in toks]


def phonetic(token: str) -> str:
    t = token
    for a, b in (("ph", "f"), ("kh", "k"), ("gh", "g"), ("sh", "s"), ("ch", "c"), ("th", "t"), ("aa", "a"), ("ee", "i"),
                 ("oo", "u"), ("ou", "u"), ("q", "k"), ("w", "v"), ("z", "s"), ("c", "k"), ("y", "i"), ("x", "ks")):
        t = t.replace(a, b)
    t = re.sub(r"(.)\1+", r"\1", t)
    head, rest = t[:1], t[1:]
    rest = re.sub(r"[aeiouh]", "", rest)
    return head + rest


def name_key(s: Any) -> str:
    return " ".join(phonetic(t) for t in name_tokens(s))


def name_similarity(a: Any, b: Any) -> dict:
    ta, tb = name_tokens(a), name_tokens(b)
    if not ta or not tb:
        return {"level": "missing", "score": None}
    sa, sb = " ".join(sorted(ta)), " ".join(sorted(tb))
    if sa == sb:
        return {"level": "exact", "score": 1.0}
    ka, kb = " ".join(sorted(phonetic(t) for t in ta)), " ".join(sorted(phonetic(t) for t in tb))
    jw = JaroWinkler.similarity(sa, sb)
    tsr = fuzz.token_sort_ratio(sa, sb) / 100
    best = max(jw, tsr)
    if ka == kb or best >= 0.92:
        return {"level": "strong", "score": round(best, 3)}
    if best >= 0.82:
        return {"level": "weak", "score": round(best, 3)}
    return {"level": "none", "score": round(best, 3)}


# ---------- Fellegi-Sunter ------------------------------------------------------
# m = P(level | same person), u = P(level | different people). weight = log2(m/u)
FS_PARAMS = {
    "name":     {"exact": (0.85, 0.002), "strong": (0.12, 0.010), "weak": (0.02, 0.03), "none": (0.01, 0.958)},
    "father":   {"exact": (0.80, 0.005), "strong": (0.15, 0.020), "weak": (0.03, 0.05), "none": (0.02, 0.925)},
    "dob":      {"exact": (0.90, 0.0003), "year": (0.06, 0.020), "none": (0.04, 0.9797)},
    "district": {"exact": (0.95, 0.05), "none": (0.05, 0.95)},
    "gender":   {"exact": (0.99, 0.50), "none": (0.01, 0.50)},
}
UPPER, LOWER = 18.0, 4.0  # MATCH if total >= UPPER; NON_MATCH if <= LOWER; else POSSIBLE -> human


def _w(field: str, level: str) -> float:
    m, u = FS_PARAMS[field][level]
    return math.log2(m / u)


def _dob_level(a: Any, b: Any) -> str:
    if not a or not b:
        return "missing"
    a, b = str(a)[:10], str(b)[:10]
    if a == b:
        return "exact"
    return "year" if a[:4] == b[:4] else "none"


def fs_compare(query: dict, rec: dict) -> dict:
    parts: dict[str, dict] = {}

    def add(field: str, level: str, detail: Any = None):
        w = 0.0 if level == "missing" else _w(field, level)
        parts[field] = {"level": level, "weight": round(w, 2), "detail": detail}

    n = name_similarity(query.get("name"), rec.get("name"))
    add("name", n["level"], n["score"])
    f = name_similarity(query.get("father_name"), rec.get("father_name"))
    add("father", f["level"], f["score"])
    add("dob", _dob_level(query.get("dob"), rec.get("dob")))
    qd, rd = (query.get("district") or "").strip().lower(), (rec.get("district") or "").strip().lower()
    add("district", "missing" if not qd or not rd else ("exact" if qd == rd else "none"))
    qg, rg = query.get("gender"), rec.get("gender")
    add("gender", "missing" if not qg or not rg else ("exact" if qg == rg else "none"))
    total = round(sum(p["weight"] for p in parts.values()), 2)
    missing = [k for k, p in parts.items() if p["level"] == "missing"]
    decision = "MATCH" if total >= UPPER else ("NON_MATCH" if total <= LOWER else "POSSIBLE")
    # Safety: a record with 2+ missing key fields can never be auto-MATCHed.
    if decision == "MATCH" and len(missing) >= 2:
        decision = "POSSIBLE"
    return {"decision": decision, "total_weight": total, "fields": parts, "missing": missing,
            "thresholds": {"upper": UPPER, "lower": LOWER}}


def find_candidates(db, query: dict, limit: int = 5) -> list[dict]:
    """Registry lookup tolerant of bad data. Exact CNIC wins; otherwise block on phonetic name + score with FS."""
    from .models import MockNadraRecord
    out: list[dict] = []
    cn = clean_cnic(query.get("cnic"))
    pool: list = []
    if cn:
        r = db.get(MockNadraRecord, cn)
        if r:
            pool = [r]
    if not pool:
        qk = name_key(query.get("name"))
        first = qk.split(" ")[0] if qk else ""
        qry = db.query(MockNadraRecord)
        if first:
            qry = qry.filter(MockNadraRecord.name_key.contains(first[:2]))
        pool = qry.limit(400).all()
    for r in pool:
        rec = {"name": r.name, "father_name": r.father_name, "dob": r.dob, "district": r.district, "gender": r.gender}
        cmp = fs_compare(query, rec)
        if cn and r.cnic == cn:
            cmp["cnic_exact"] = True
        out.append({"cnic": r.cnic, "record_name": r.name, "comparison": cmp})
    out.sort(key=lambda x: x["comparison"]["total_weight"], reverse=True)
    return out[:limit]
