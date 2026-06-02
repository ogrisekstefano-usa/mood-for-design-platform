"""
RCA Validation — reproduces the "module-level fail-cache" pathology
described in EMAIL_DELIVERY_RCA.md, then verifies that the new
runtime-evaluated dispatcher does NOT exhibit it.

This is the TASK 7 evidence: not supposition, actual demonstration.

The two scenarios:

  A) BUGGY (pre-fix): a module that reads RESEND_API_KEY at IMPORT TIME
     into a module-level constant.
     → If the env is missing at import, the constant is empty FOREVER,
       even after the env is populated. The sandbox short-circuit fires
       for every subsequent dispatch.

  B) FIXED  (post-fix): dispatcher uses `_resend_api_key()` runtime
     accessor that re-reads os.environ on every call.
     → If the env is missing at import, the constant logic is bypassed,
       and the next call (with env now populated) goes through Resend.

Run: python3 -m scripts.email_rca_validation
"""
from __future__ import annotations
import os, sys, importlib, asyncio
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def scenario_a_module_level_failcache():
    """Reproduce the buggy pattern in isolation."""
    # Step 1 — simulate "process spawned BEFORE load_dotenv":
    saved = os.environ.pop('RESEND_API_KEY', None)
    try:
        # Step 2 — define a buggy module that captures the value at import
        src = """
import os
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '').strip()
def is_sandbox():
    return not RESEND_API_KEY
"""
        import types
        buggy = types.ModuleType('buggy_dispatcher')
        exec(src, buggy.__dict__)

        # At this point, buggy.RESEND_API_KEY = "" (fail-cached)
        captured_at_import = buggy.RESEND_API_KEY
        assert captured_at_import == '', f"expected empty, got {captured_at_import!r}"

        # Step 3 — simulate load_dotenv arriving LATER
        os.environ['RESEND_API_KEY'] = 're_real_valid_key_123'

        # Step 4 — even with env now valid, the module's constant is STILL empty
        still_empty = buggy.RESEND_API_KEY
        sandbox_after = buggy.is_sandbox()

        return {
            'captured_at_import': captured_at_import,
            'env_after_dotenv':    os.environ.get('RESEND_API_KEY'),
            'module_constant_now': still_empty,
            'sandbox_short_circuit_fires': sandbox_after,
        }
    finally:
        if saved is not None:
            os.environ['RESEND_API_KEY'] = saved
        else:
            os.environ.pop('RESEND_API_KEY', None)


def scenario_b_runtime_evaluation():
    """Demonstrate the fix: runtime accessor, no fail-cache.

    Strategy: monkeypatch os.environ.get to control what the dispatcher
    sees on each call, without reloading dotenv (which would defeat the
    purpose of the test).
    """
    import services.email_dispatcher as m

    # The fix exposes `_resend_api_key`, NOT a module-level constant.
    has_constant = hasattr(m, 'RESEND_API_KEY')
    has_runtime_fn = callable(getattr(m, '_resend_api_key', None))

    # Demonstrate that the accessor re-reads os.environ on every call.
    saved = os.environ.pop('RESEND_API_KEY', None)
    try:
        # State 1: env missing → empty → sandbox
        key_empty = m._resend_api_key()
        sandbox_empty = m._is_sandbox_key(key_empty)
        # State 2: env populated → valid → NOT sandbox
        os.environ['RESEND_API_KEY'] = 're_runtime_valid_key_456'
        key_valid = m._resend_api_key()
        sandbox_valid = m._is_sandbox_key(key_valid)
        # State 3: env REMOVED again → recovers to empty
        os.environ.pop('RESEND_API_KEY', None)
        key_removed = m._resend_api_key()
        sandbox_removed = m._is_sandbox_key(key_removed)
    finally:
        if saved is not None:
            os.environ['RESEND_API_KEY'] = saved
        else:
            os.environ.pop('RESEND_API_KEY', None)

    return {
        'has_module_constant_RESEND_API_KEY':  has_constant,
        'has_runtime_fn_resend_api_key':       has_runtime_fn,
        'key_when_env_missing':                key_empty,
        'sandbox_check_when_env_missing':      sandbox_empty,
        'key_when_env_populated':              key_valid,
        'sandbox_check_when_env_populated':    sandbox_valid,
        'key_when_env_removed_again':          key_removed,
        'sandbox_check_when_env_removed_again': sandbox_removed,
    }


def main():
    print("\n=== TASK 7 — RCA TECHNICAL VALIDATION ===\n")

    print("SCENARIO A — BUGGY (module-level constant, pre-fix)")
    a = scenario_a_module_level_failcache()
    for k, v in a.items():
        print(f"  {k:35s} = {v!r}")
    bug_confirmed = (a['captured_at_import'] == ''
                     and a['env_after_dotenv'] == 're_real_valid_key_123'
                     and a['module_constant_now'] == ''
                     and a['sandbox_short_circuit_fires'] is True)
    print(f"  → Pathology reproduced: {bug_confirmed}")

    print("\nSCENARIO B — FIXED (runtime accessor, post-fix)")
    b = scenario_b_runtime_evaluation()
    for k, v in b.items():
        print(f"  {k:42s} = {v!r}")
    fix_works = (
        b['has_module_constant_RESEND_API_KEY'] is False
        and b['has_runtime_fn_resend_api_key']  is True
        and b['key_when_env_missing']           == ''
        and b['sandbox_check_when_env_missing'] is True
        and b['key_when_env_populated']         == 're_runtime_valid_key_456'
        and b['sandbox_check_when_env_populated'] is False
        and b['key_when_env_removed_again']     == ''
        and b['sandbox_check_when_env_removed_again'] is True
    )
    print(f"  → Fix verified: {fix_works}")

    print(f"\nRCA HYPOTHESIS  : module-level fail-cache by import order vs load_dotenv")
    print(f"  reproduced     : {bug_confirmed}")
    print(f"  fixed in code  : {fix_works}")
    overall = bug_confirmed and fix_works
    print(f"\nOVERALL EVIDENCE: {'CONFIRMED' if overall else 'INCONCLUSIVE'}")
    return 0 if overall else 1


if __name__ == '__main__':
    sys.exit(main())
