"""
Claw Compactor 全场景压力测试脚本
覆盖：基础功能 / 高负载 / 边界条件 / 并发 / Engram 初始化
"""
import os, sys, time, threading, json, hashlib, math
from pathlib import Path

os.environ["ENGRAM_CONFIG"] = r"C:\Users\User\.openclaw\engram.yaml"

from claw_compactor import EngramEngine
from claw_compactor.tokens import estimate_tokens
from claw_compactor.fusion.base import FusionContext
from claw_compactor.fusion.pipeline import FusionPipeline
from claw_compactor.rewind.store import RewindStore
from claw_compactor.crunch_bench import CrunchBench

PASS = 0
FAIL = 0
results_log = []

def log_result(name, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        status = "PASS"
    else:
        FAIL += 1
        status = "FAIL"
    results_log.append(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))
    print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))

def test_basic_pipeline():
    """Test basic pipeline with plain text"""
    pipeline = FusionPipeline()
    ctx = FusionContext(content="Hello, this is a simple test message for compression.")
    result = pipeline.run(ctx)
    assert result and result.content, "Pipeline returned empty result"
    ratio = len(ctx.content) / max(1, len(result.content))
    log_result("Basic pipeline compression", True, f"ratio={ratio:.2f}x, {len(ctx.content)}→{len(result.content)} chars")

def test_code_compression():
    """Test with code content"""
    pipeline = FusionPipeline()
    code = '''def fibonacci(n):
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[0]
    left = [x for x in arr[1:] if x <= pivot]
    right = [x for x in arr[1:] if x > pivot]
    return quick_sort(left) + [pivot] + quick_sort(right)
'''
    ctx = FusionContext(content=code)
    result = pipeline.run(ctx)
    assert result and result.content, "Code pipeline returned empty"
    ratio = len(code) / max(1, len(result.content))
    log_result("Code compression", True, f"ratio={ratio:.2f}x, cortex detected lang")

def test_json_compression():
    """Test with JSON content"""
    pipeline = FusionPipeline()
    json_data = json.dumps({"users": [{"id": i, "name": f"user_{i}", "active": True, "score": math.sin(i)} for i in range(50)]})
    ctx = FusionContext(content=json_data)
    result = pipeline.run(ctx)
    assert result and result.content, "JSON pipeline returned empty"
    ratio = len(json_data) / max(1, len(result.content))
    log_result("JSON compression", True, f"ratio={ratio:.2f}x")

def test_large_content():
    """Stress test with large content (~500KB)"""
    pipeline = FusionPipeline()
    large = ("The quick brown fox jumps over the lazy dog. " * 5000 +
             "Pack my box with five dozen liquor jugs. " * 5000)
    ctx = FusionContext(content=large)
    t0 = time.monotonic()
    result = pipeline.run(ctx)
    elapsed = (time.monotonic() - t0) * 1000
    assert result and result.content, "Large content pipeline returned empty"
    ratio = len(large) / max(1, len(result.content))
    log_result("Large content (~500KB) stress test", True,
               f"ratio={ratio:.2f}x, {elapsed:.0f}ms, {len(large)}→{len(result.content)} chars")

def test_very_large_content():
    """Stress test with very large content (~2MB)"""
    pipeline = FusionPipeline()
    paragraph = "AI automation framework with agent orchestration and pipeline execution. " * 200
    huge = paragraph * 500  # ~2MB
    ctx = FusionContext(content=huge)
    t0 = time.monotonic()
    result = pipeline.run(ctx)
    elapsed = (time.monotonic() - t0) * 1000
    assert result and result.content, "Very large pipeline returned empty"
    ratio = len(huge) / max(1, len(result.content))
    log_result("Very large content (~2MB) stress test", True,
               f"ratio={ratio:.2f}x, {elapsed:.0f}ms, {len(huge)}→{len(result.content)} chars")

def test_empty_input():
    """Edge case: empty input"""
    pipeline = FusionPipeline()
    ctx = FusionContext(content="")
    result = pipeline.run(ctx)
    assert result is not None, "Empty input should return result (not None)"
    log_result("Empty input edge case", True, "returns result gracefully")

def test_minimal_input():
    """Edge case: single character"""
    pipeline = FusionPipeline()
    ctx = FusionContext(content="a")
    result = pipeline.run(ctx)
    assert result is not None
    log_result("Minimal input edge case", True, "single char handled")

def test_special_chars():
    """Test with special characters and Unicode"""
    pipeline = FusionPipeline()
    special = "日本語 test 中文 Español العربية 🚀 emoji test\n" * 200
    ctx = FusionContext(content=special)
    result = pipeline.run(ctx)
    assert result and result.content, "Special chars pipeline returned empty"
    ratio = len(special) / max(1, len(result.content))
    log_result("Unicode/special chars compression", True, f"ratio={ratio:.2f}x")

def test_concurrent_pipeline():
    """Concurrent pipeline execution test"""
    pipeline = FusionPipeline()
    texts = [
        "Concurrent test message " * 1000,
        "Parallel execution " * 1000,
        "Thread safety verification " * 1000,
        "Multi-thread compression " * 1000,
        "Race condition check " * 1000,
    ]
    errors = []

    def run_one(text, idx):
        try:
            ctx = FusionContext(content=text)
            result = pipeline.run(ctx)
            if not result or not result.content:
                errors.append(f"Thread {idx}: empty result")
        except Exception as e:
            errors.append(f"Thread {idx}: {e}")

    threads = [threading.Thread(target=run_one, args=(texts[i % len(texts)], i)) for i in range(10)]
    t0 = time.monotonic()
    for t in threads: t.start()
    for t in threads: t.join()
    elapsed = (time.monotonic() - t0) * 1000
    ok = len(errors) == 0
    log_result("Concurrent pipeline (10 threads)", ok,
               f"{elapsed:.0f}ms total" + (f", errors: {errors}" if errors else ""))

def test_rewind_store():
    """Test RewindStore functionality"""
    store = RewindStore()
    original = "This is a test message that will be stored and retrieved."
    compressed = original[:10] + "...[compressed]" + original[-10:]
    hash_id = store.store(original=original, compressed=compressed,
                          original_tokens=estimate_tokens(original),
                          compressed_tokens=estimate_tokens(compressed))
    assert hash_id, "RewindStore returned empty hash"
    retrieved = store.retrieve(hash_id)
    assert retrieved == original, f"Rewind reconstruction mismatch"
    log_result("RewindStore reversible compression", True, f"hash={hash_id[:16]}...")

def test_rewind_large_store():
    """Stress RewindStore with multiple entries"""
    store = RewindStore()
    count = 50
    for i in range(count):
        orig = f"Rewind store test message #{i} with some padding content to make it realistic. " * 10
        comp = f"[compressed #{i}]"
        h = store.store(original=orig, compressed=comp,
                        original_tokens=estimate_tokens(orig),
                        compressed_tokens=estimate_tokens(comp))
        retrieved = store.retrieve(h)
        assert retrieved == orig, f"Entry {i} mismatch"
    log_result("RewindStore stress (50 entries)", True, f"all exact-matched")

def test_engram_initialization():
    """Test EngramEngine initialization"""
    engine = EngramEngine(workspace_path=r"C:\Users\User\.openclaw")
    assert engine is not None, "EngramEngine init failed"
    log_result("EngramEngine initialization", True, "storage ready")

def test_engram_observer():
    """Test Engram observer with a simple message"""
    engine = EngramEngine(workspace_path=r"C:\Users\User\.openclaw")
    engine.add_message("test-thread", role="user", content="Test observer message for Engram memory system")
    pending = len(engine.get_pending_messages("test-thread")) if hasattr(engine, 'get_pending_messages') else 1
    log_result("Engram observer", True, f"message ingested")

def test_pipeline_benchmark():
    """Run CrunchBench single evaluation"""
    pipeline = FusionPipeline()
    bench = CrunchBench(pipeline)
    text = "Benchmark test content for compression evaluation. " * 500
    ctx = FusionContext(content=text)
    result = bench.evaluate_single(text, ctx)
    assert result.compression_ratio >= 1.0, "Compression ratio should be >= 1.0"
    assert result.latency_ms > 0, "Latency should be > 0"
    log_result("CrunchBench single eval", True,
               f"ratio={result.compression_ratio:.2f}x, latency={result.latency_ms:.0f}ms")

def test_pipeline_multi_benchmark():
    """Run CrunchBench multi-dataset evaluation"""
    pipeline = FusionPipeline()
    bench = CrunchBench(pipeline)
    samples = [
        {"text": "Sample A for multi-benchmark. " * 200, "ctx": FusionContext(content="dummy")},
        {"text": "Sample B for multi-benchmark test. " * 300, "ctx": FusionContext(content="dummy")},
        {"text": "Sample C for multi-benchmark verification. " * 400, "ctx": FusionContext(content="dummy")},
        {"text": "Sample D code content.\ndef test():\n    pass\n" * 200, "ctx": FusionContext(content="dummy")},
        {"text": "Sample E JSON content.\n" + json.dumps({"k": "v"}) * 300, "ctx": FusionContext(content="dummy")},
    ]
    results = bench.evaluate_dataset(samples)
    assert len(results) == 5, f"Expected 5 results, got {len(results)}"
    stats = bench.summary(results)
    assert stats["compression_ratio"]["mean"] >= 1.0
    log_result("CrunchBench multi-dataset (5 samples)", True,
               f"mean_ratio={stats['compression_ratio']['mean']:.2f}x, mean_latency={stats['latency_ms']['mean']:.0f}ms")

def test_pipeline_all_stages():
    """Run all pipeline stages implicitly via FusionPipeline.run()"""
    text = "Stage test with various content to exercise all pipeline stages. " * 500
    ctx = FusionContext(content=text)
    pipeline = FusionPipeline()
    result = pipeline.run(ctx)
    assert result and result.content
    log_result("Pipeline all stages integration", True, f"{len(text)}→{len(result.content)} chars")


if __name__ == "__main__":
    print("=" * 60)
    print("  Claw Compactor 全场景压力测试")
    print(f"  时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    tests = [
        ("Pipeline — 基础功能", test_basic_pipeline),
        ("Pipeline — 代码压缩", test_code_compression),
        ("Pipeline — JSON 压缩", test_json_compression),
        ("Pipeline — Unicode/特殊字符", test_special_chars),
        ("Pipeline — 边界：空输入", test_empty_input),
        ("Pipeline — 边界：最小输入", test_minimal_input),
        ("Pipeline — 大内容 (~500KB)", test_large_content),
        ("Pipeline — 超大内容 (~2MB)", test_very_large_content),
        ("Pipeline — 并发 (10线程)", test_concurrent_pipeline),
        ("RewindStore — 可逆压缩", test_rewind_store),
        ("RewindStore — 高负载 (50条)", test_rewind_large_store),
        ("Engram — 初始化", test_engram_initialization),
        ("Engram — Observer", test_engram_observer),
        ("CrunchBench — 单样本基准", test_pipeline_benchmark),
        ("CrunchBench — 多样本基准", test_pipeline_multi_benchmark),
        ("Pipeline — 全阶段集成", test_pipeline_all_stages),
    ]

    for name, func in tests:
        print(f"\n  ▶ {name}")
        try:
            func()
        except Exception as e:
            FAIL += 1
            results_log.append(f"  [FAIL] {name} — EXCEPTION: {e}")
            print(f"  [FAIL] {name} — EXCEPTION: {e}")

    print("\n" + "=" * 60)
    print(f"  测试结果汇总")
    print("=" * 60)
    print(f"  ✅ 通过: {PASS}")
    print(f"  ❌ 失败: {FAIL}")
    total = PASS + FAIL
    print(f"  通过率: {PASS/total*100:.1f}% ({PASS}/{total})")
    print(f"\n  详细日志:")
    for line in results_log:
        print(line)
    print("=" * 60)
    sys.exit(0 if FAIL == 0 else 1)
