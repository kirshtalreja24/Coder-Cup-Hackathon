"""Tiny in-process monitoring: request counts, error counts, latency percentiles. Exposed at /metrics (and in the eval dashboard)."""
import threading
import time
from collections import Counter, deque


class Metrics:
    def __init__(self):
        self.started = time.time()
        self.lock = threading.Lock()
        self.count = 0
        self.status = Counter()
        self.lat = deque(maxlen=2000)
        self.routes = Counter()
        self.errors = deque(maxlen=20)

    def record(self, path: str, code: int, ms: float, err: str | None = None):
        with self.lock:
            self.count += 1
            self.status[str(code // 100) + "xx"] += 1
            self.lat.append(ms)
            self.routes[path] += 1
            if err:
                self.errors.append({"path": path, "error": err, "at": time.strftime("%H:%M:%S")})

    def snapshot(self) -> dict:
        with self.lock:
            lat = sorted(self.lat)
            pick = lambda q: round(lat[min(int(len(lat) * q), len(lat) - 1)], 1) if lat else None
            return {"uptime_s": int(time.time() - self.started), "requests": self.count, "by_status": dict(self.status),
                    "latency_ms": {"p50": pick(0.5), "p95": pick(0.95), "p99": pick(0.99)}, "recent_errors": list(self.errors),
                    "top_routes": self.routes.most_common(8)}


METRICS = Metrics()
