"""Static guard on .github/workflows/pages.yml (PUB-02: deploy gated by tests)."""
from pathlib import Path

import pytest
import yaml

WF_PATH = Path(__file__).resolve().parent.parent / ".github" / "workflows" / "pages.yml"


@pytest.fixture(scope="module")
def wf():
    assert WF_PATH.exists(), "pages.yml missing"
    return yaml.safe_load(WF_PATH.read_text(encoding="utf-8"))


def _triggers(wf):
    return wf.get("on", wf.get(True))


def _steps(job):
    return job.get("steps", [])


def test_triggers(wf):
    on = _triggers(wf)
    branches = on["push"]["branches"]
    assert "master" in branches and "main" in branches
    assert "pull_request" in on
    assert "workflow_dispatch" in on


def test_test_job_runs_both_suites(wf):
    steps = _steps(wf["jobs"]["test"])
    runs = [s.get("run", "") for s in steps]
    assert any("pytest" in r for r in runs)
    assert any("node --test" in r for r in runs)
    node = [s for s in steps if str(s.get("uses", "")).startswith("actions/setup-node")]
    assert node and int(str(node[0]["with"]["node-version"])) >= 22


def test_test_job_cannot_be_bypassed(wf):
    job = wf["jobs"]["test"]
    assert job.get("continue-on-error") is not True
    for s in _steps(job):
        assert s.get("continue-on-error") is not True
        run = s.get("run", "")
        assert "|| true" not in run and "|| exit 0" not in run


def test_deploy_needs_test_and_skips_prs(wf):
    dep = wf["jobs"]["deploy"]
    needs = dep["needs"]
    assert needs == "test" or "test" in needs
    assert "pull_request" in dep["if"] and "!=" in dep["if"]


def test_deploy_permissions_and_environment(wf):
    dep = wf["jobs"]["deploy"]
    assert dep["permissions"]["pages"] == "write"
    assert dep["permissions"]["id-token"] == "write"
    assert dep["environment"]["name"] == "github-pages"


def test_deploy_steps(wf):
    steps = _steps(wf["jobs"]["deploy"])
    up = [s for s in steps if str(s.get("uses", "")).startswith("actions/upload-pages-artifact")]
    assert up and up[0]["with"]["path"] == "site"
    dp = [s for s in steps if str(s.get("uses", "")).startswith("actions/deploy-pages")]
    assert dp and dp[0].get("id") == "deployment"


def test_least_privilege(wf):
    assert wf["permissions"]["contents"] == "read"
    for job in wf["jobs"].values():
        assert (job.get("permissions") or {}).get("contents") != "write"
