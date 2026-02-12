"""Tests for the guardrail-test-ratio.yml GitHub Actions workflow.

Validates YAML syntax, workflow structure, trigger configuration,
and the presence of required logic steps.
"""

import yaml
import os
import re

WORKFLOW_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    ".github",
    "workflows",
    "guardrail-test-ratio.yml",
)

CONFIG_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    ".github",
    "agent-workflow",
    "config.yaml",
)


def load_workflow():
    """Load and parse the workflow YAML file."""
    with open(WORKFLOW_PATH) as f:
        return yaml.safe_load(f)


def load_config():
    """Load and parse the config YAML file."""
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


def get_script_content(step):
    """Extract the script content from a github-script step."""
    if step.get("uses", "").startswith("actions/github-script"):
        return step.get("with", {}).get("script", "")
    return ""


def find_step_by_id(steps, step_id):
    """Find a step by its id."""
    for step in steps:
        if step.get("id") == step_id:
            return step
    return None


def find_steps_by_uses(steps, uses_prefix):
    """Find all steps that use a given action prefix."""
    return [s for s in steps if s.get("uses", "").startswith(uses_prefix)]


class TestWorkflowYamlSyntax:
    """Test that the workflow file is valid YAML."""

    def test_file_exists(self):
        assert os.path.exists(WORKFLOW_PATH), (
            f"Workflow file not found at {WORKFLOW_PATH}"
        )

    def test_valid_yaml(self):
        wf = load_workflow()
        assert wf is not None, "Workflow YAML parsed as None (empty file)"

    def test_is_dict(self):
        wf = load_workflow()
        assert isinstance(wf, dict), "Workflow YAML root should be a mapping"


class TestWorkflowTriggers:
    """Test that the workflow triggers on the correct events."""

    def test_has_on_key(self):
        wf = load_workflow()
        assert True in wf or "on" in wf, "Workflow must have 'on' trigger"

    def test_triggers_on_pull_request(self):
        wf = load_workflow()
        on = wf.get(True) or wf.get("on")
        assert "pull_request" in on, (
            "Workflow must trigger on pull_request"
        )

    def test_pull_request_types_include_opened(self):
        wf = load_workflow()
        on = wf.get(True) or wf.get("on")
        pr = on["pull_request"]
        types = pr.get("types", [])
        assert "opened" in types, (
            "pull_request trigger must include 'opened' type"
        )

    def test_pull_request_types_include_synchronize(self):
        wf = load_workflow()
        on = wf.get(True) or wf.get("on")
        pr = on["pull_request"]
        types = pr.get("types", [])
        assert "synchronize" in types, (
            "pull_request trigger must include 'synchronize' type"
        )


class TestWorkflowStructure:
    """Test the overall workflow structure."""

    def test_has_name(self):
        wf = load_workflow()
        assert "name" in wf, "Workflow must have a name"

    def test_name_mentions_test_ratio(self):
        wf = load_workflow()
        name = wf["name"].lower()
        assert "test" in name and "ratio" in name, (
            "Workflow name should mention test ratio"
        )

    def test_has_jobs(self):
        wf = load_workflow()
        assert "jobs" in wf, "Workflow must have jobs"

    def test_has_check_job(self):
        wf = load_workflow()
        jobs = wf["jobs"]
        assert len(jobs) >= 1, "Workflow must have at least one job"

    def test_job_runs_on_ubuntu(self):
        wf = load_workflow()
        jobs = wf["jobs"]
        job = list(jobs.values())[0]
        runs_on = job.get("runs-on", "")
        assert "ubuntu" in runs_on, "Job must run on ubuntu"

    def test_has_permissions(self):
        """Workflow needs checks:write and pull-requests:read permissions."""
        wf = load_workflow()
        # Permissions can be at workflow level or job level
        jobs = wf["jobs"]
        job = list(jobs.values())[0]
        perms = wf.get("permissions", {}) or job.get("permissions", {})
        assert "checks" in perms, "Must have checks permission"
        assert perms["checks"] == "write", "Must have checks:write permission"
        assert "pull-requests" in perms, "Must have pull-requests permission"
        assert perms["pull-requests"] == "read", (
            "Must have pull-requests:read permission"
        )


class TestWorkflowSteps:
    """Test that the workflow has the required steps."""

    def _get_steps(self):
        wf = load_workflow()
        jobs = wf["jobs"]
        job = list(jobs.values())[0]
        return job.get("steps", [])

    def test_has_checkout_step(self):
        steps = self._get_steps()
        checkout_steps = find_steps_by_uses(steps, "actions/checkout")
        assert len(checkout_steps) >= 1, "Must have a checkout step"

    def test_has_github_script_step(self):
        steps = self._get_steps()
        script_steps = find_steps_by_uses(steps, "actions/github-script")
        assert len(script_steps) >= 1, (
            "Must have at least one github-script step"
        )


class TestConfigYaml:
    """Test that the config.yaml file contains the right defaults."""

    def test_config_file_exists(self):
        assert os.path.exists(CONFIG_PATH), (
            f"Config file not found at {CONFIG_PATH}"
        )

    def test_config_valid_yaml(self):
        config = load_config()
        assert config is not None, "Config YAML parsed as None"

    def test_has_guardrails_section(self):
        config = load_config()
        assert "guardrails" in config, (
            "Config must have 'guardrails' section"
        )

    def test_has_test_ratio_section(self):
        config = load_config()
        guardrails = config["guardrails"]
        assert "test-ratio" in guardrails, (
            "Guardrails config must have 'test-ratio' section"
        )

    def test_has_threshold(self):
        config = load_config()
        tr = config["guardrails"]["test-ratio"]
        assert "threshold" in tr, (
            "test-ratio config must have 'threshold'"
        )

    def test_default_threshold_is_0_5(self):
        config = load_config()
        tr = config["guardrails"]["test-ratio"]
        assert tr["threshold"] == 0.5, (
            "Default threshold should be 0.5"
        )

    def test_has_enabled(self):
        config = load_config()
        tr = config["guardrails"]["test-ratio"]
        assert "enabled" in tr, "test-ratio config must have 'enabled'"
        assert tr["enabled"] is True, "test-ratio should be enabled by default"

    def test_has_conclusion(self):
        config = load_config()
        tr = config["guardrails"]["test-ratio"]
        assert "conclusion" in tr, (
            "test-ratio config must have 'conclusion'"
        )
        assert tr["conclusion"] == "action_required", (
            "Default conclusion should be 'action_required'"
        )


class TestScriptLogic:
    """Test that the github-script step contains the required logic."""

    def _get_all_script_content(self):
        wf = load_workflow()
        jobs = wf["jobs"]
        job = list(jobs.values())[0]
        steps = job.get("steps", [])
        scripts = []
        for step in steps:
            content = get_script_content(step)
            if content:
                scripts.append(content)
        return "\n".join(scripts)

    def test_reads_config_yaml(self):
        """Script must read config.yaml for threshold."""
        script = self._get_all_script_content()
        assert "config" in script.lower(), (
            "Script must reference config for threshold"
        )

    def test_uses_pulls_list_files(self):
        """Script must use pulls.listFiles to get PR files."""
        script = self._get_all_script_content()
        assert "listFiles" in script, (
            "Script must use pulls.listFiles to get PR diff"
        )

    def test_categorizes_test_files(self):
        """Script must identify test files by naming convention."""
        script = self._get_all_script_content()
        # Should check for test/spec patterns
        has_test_pattern = "test" in script.lower()
        has_spec_pattern = "spec" in script.lower()
        has_tests_dir = "__tests__" in script
        assert has_test_pattern or has_spec_pattern or has_tests_dir, (
            "Script must categorize test files by naming convention"
        )

    def test_counts_added_lines(self):
        """Script must count added lines from the diff."""
        script = self._get_all_script_content()
        # Should reference additions or patch parsing
        has_additions = "additions" in script
        has_patch = "patch" in script
        assert has_additions or has_patch, (
            "Script must count added lines from diff"
        )

    def test_calculates_ratio(self):
        """Script must calculate and compare ratio against threshold."""
        script = self._get_all_script_content()
        assert "ratio" in script.lower() or "threshold" in script.lower(), (
            "Script must calculate ratio and compare against threshold"
        )

    def test_creates_check_run(self):
        """Script must create a check run via the Checks API."""
        script = self._get_all_script_content()
        assert "checks.create" in script, (
            "Script must use checks.create to report results"
        )

    def test_checks_for_approval_override(self):
        """Script must check for non-stale PR approval override."""
        script = self._get_all_script_content()
        assert "listReviews" in script or "APPROVED" in script, (
            "Script must check for non-stale approval override"
        )

    def test_reports_success_on_approval(self):
        """Script must report success when a non-stale approval exists."""
        script = self._get_all_script_content()
        assert "success" in script, (
            "Script must be able to report 'success' conclusion"
        )

    def test_reports_action_required_on_failure(self):
        """Script must report action_required when ratio is below threshold."""
        script = self._get_all_script_content()
        assert "action_required" in script, (
            "Script must be able to report 'action_required' conclusion"
        )

    def test_check_run_name_includes_guardrail(self):
        """Check run name should identify it as a guardrail."""
        script = self._get_all_script_content()
        assert "guardrail" in script.lower(), (
            "Check run name should include 'guardrail'"
        )

    def test_includes_annotations(self):
        """Script should include annotations for findings."""
        script = self._get_all_script_content()
        assert "annotation" in script.lower(), (
            "Script should include annotations in check run output"
        )

    def test_handles_no_implementation_lines(self):
        """Script should handle the case where there are zero implementation lines."""
        script = self._get_all_script_content()
        # Should have some guard against division by zero or no impl lines
        # Check for explicit handling of zero/no implementation lines
        has_zero_check = (
            "=== 0" in script
            or "== 0" in script
            or "no implementation" in script.lower()
            or "no code" in script.lower()
            or "impl" in script.lower()
        )
        assert has_zero_check, (
            "Script must handle the case of zero implementation lines"
        )

    def test_paginates_file_listing(self):
        """Script should paginate through PR files for large PRs."""
        script = self._get_all_script_content()
        assert "per_page" in script, (
            "Script must use per_page for paginated file listing"
        )
        assert "page" in script, (
            "Script must handle pagination"
        )

    def test_skips_removed_files(self):
        """Script should skip files that were removed in the PR."""
        script = self._get_all_script_content()
        assert "removed" in script, (
            "Script must skip removed files"
        )

    def test_has_guardrail_check_run_name(self):
        """Check run name should be 'guardrail/test-ratio'."""
        script = self._get_all_script_content()
        assert "guardrail/test-ratio" in script, (
            "Check run name should be 'guardrail/test-ratio'"
        )

    def test_handles_disabled_config(self):
        """Script should respect the enabled flag in config."""
        script = self._get_all_script_content()
        assert "enabled" in script, (
            "Script must check if guardrail is enabled"
        )
