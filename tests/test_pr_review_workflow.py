"""
Tests for .github/workflows/pr-review.yml

Validates the workflow structure, trigger configuration, permissions,
parallel reviewer jobs, and the expected prompt construction for each
reviewer skill invoked via `claude -p`.
"""

import yaml
import os
import re
import pytest

WORKFLOW_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    ".github",
    "workflows",
    "pr-review.yml",
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


def get_on(wf):
    """Get the 'on' trigger, handling YAML parsing of bare 'on' as True."""
    return wf.get(True) or wf.get("on")


# ── YAML Validity ────────────────────────────────────────────────────


class TestYamlValidity:
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

    def test_is_valid_github_actions_workflow(self):
        wf = load_workflow()
        assert "name" in wf, "Workflow must have a name"
        assert get_on(wf) is not None, "Workflow must have triggers"
        assert "jobs" in wf, "Workflow must have jobs"


# ── Triggers ─────────────────────────────────────────────────────────


class TestTriggers:
    def test_triggers_on_pull_request(self):
        wf = load_workflow()
        on = get_on(wf)
        assert "pull_request" in on, (
            "Must trigger on pull_request event"
        )

    def test_pull_request_types_include_opened(self):
        wf = load_workflow()
        on = get_on(wf)
        pr = on["pull_request"]
        types = pr.get("types", [])
        assert "opened" in types, (
            "pull_request trigger must include 'opened' type"
        )

    def test_pull_request_types_include_synchronize(self):
        wf = load_workflow()
        on = get_on(wf)
        pr = on["pull_request"]
        types = pr.get("types", [])
        assert "synchronize" in types, (
            "pull_request trigger must include 'synchronize' type"
        )

    def test_has_workflow_dispatch_trigger(self):
        """The orchestrator needs to re-trigger reviews via workflow_dispatch."""
        wf = load_workflow()
        on = get_on(wf)
        assert "workflow_dispatch" in on, (
            "Must have workflow_dispatch trigger so orchestrator can re-trigger reviews"
        )

    def test_workflow_dispatch_has_pr_number_input(self):
        """workflow_dispatch must accept a PR number input."""
        wf = load_workflow()
        on = get_on(wf)
        wd = on["workflow_dispatch"]
        assert "inputs" in wd, "workflow_dispatch must have inputs"
        inputs = wd["inputs"]
        # Should have a pr-number or pr_number input
        has_pr_input = any(
            "pr" in key.lower() for key in inputs.keys()
        )
        assert has_pr_input, (
            "workflow_dispatch must have a PR number input"
        )


# ── Permissions ──────────────────────────────────────────────────────


class TestPermissions:
    def _get_permissions(self):
        wf = load_workflow()
        return wf.get("permissions", {})

    def test_has_contents_write(self):
        perms = self._get_permissions()
        assert perms.get("contents") == "write", (
            "Needs contents:write to check out repo"
        )

    def test_has_issues_write(self):
        perms = self._get_permissions()
        assert perms.get("issues") == "write", (
            "Needs issues:write to create child issues for findings"
        )

    def test_has_pull_requests_read(self):
        perms = self._get_permissions()
        assert perms.get("pull-requests") == "read", (
            "Needs pull-requests:read to read PR diff and description"
        )


# ── Jobs: Three Parallel Reviewers ───────────────────────────────────


class TestReviewerJobs:
    """The workflow must have three separate jobs for parallel reviewer execution."""

    def _get_jobs(self):
        wf = load_workflow()
        return wf.get("jobs", {})

    def test_has_at_least_three_jobs(self):
        jobs = self._get_jobs()
        assert len(jobs) >= 3, (
            f"Workflow must have at least 3 jobs (one per reviewer), found {len(jobs)}"
        )

    def test_has_correctness_reviewer_job(self):
        jobs = self._get_jobs()
        correctness_jobs = [
            k for k in jobs if "correctness" in k.lower()
        ]
        assert len(correctness_jobs) >= 1, (
            "Must have a job for the correctness reviewer"
        )

    def test_has_tests_reviewer_job(self):
        jobs = self._get_jobs()
        test_jobs = [
            k for k in jobs if "test" in k.lower()
        ]
        assert len(test_jobs) >= 1, (
            "Must have a job for the tests reviewer"
        )

    def test_has_architecture_reviewer_job(self):
        jobs = self._get_jobs()
        arch_jobs = [
            k for k in jobs if "architecture" in k.lower()
        ]
        assert len(arch_jobs) >= 1, (
            "Must have a job for the architecture reviewer"
        )

    def test_reviewer_jobs_are_independent(self):
        """Reviewer jobs must not depend on each other (parallel execution)."""
        jobs = self._get_jobs()
        reviewer_keys = [
            k for k in jobs
            if "correctness" in k.lower()
            or "test" in k.lower()
            or "architecture" in k.lower()
        ]
        for key in reviewer_keys:
            needs = jobs[key].get("needs", [])
            # needs should not reference other reviewer jobs
            other_reviewers = [
                r for r in reviewer_keys if r != key
            ]
            for dep in (needs if isinstance(needs, list) else [needs]):
                assert dep not in other_reviewers, (
                    f"Reviewer job '{key}' depends on '{dep}' — reviewers must run in parallel"
                )

    def test_all_reviewer_jobs_run_on_ubuntu(self):
        jobs = self._get_jobs()
        reviewer_keys = [
            k for k in jobs
            if "correctness" in k.lower()
            or "test" in k.lower()
            or "architecture" in k.lower()
        ]
        for key in reviewer_keys:
            runs_on = jobs[key].get("runs-on", "")
            assert "ubuntu" in runs_on, (
                f"Reviewer job '{key}' must run on ubuntu"
            )


# ── Parse Parent Issue ───────────────────────────────────────────────


class TestParseParentIssue:
    """The workflow must parse 'fixes #N' or 'Fixes #N' from the PR description."""

    def _get_all_step_content(self):
        """Collect all run/script content from all jobs."""
        wf = load_workflow()
        content_parts = []
        for job_name, job in wf.get("jobs", {}).items():
            for step in job.get("steps", []):
                # Collect 'run' scripts
                if "run" in step:
                    content_parts.append(step["run"])
                # Collect github-script content
                if step.get("uses", "").startswith("actions/github-script"):
                    script = step.get("with", {}).get("script", "")
                    content_parts.append(script)
                # Collect env vars
                env = step.get("env", {})
                for v in env.values():
                    if isinstance(v, str):
                        content_parts.append(v)
            # Also collect job-level env
            env = job.get("env", {})
            for v in env.values():
                if isinstance(v, str):
                    content_parts.append(v)
        return "\n".join(content_parts)

    def test_parses_fixes_reference(self):
        """Must extract parent issue number from PR body 'fixes #N' or 'Fixes #N'."""
        content = self._get_all_step_content()
        # Should contain a regex or string match for fixes #N (case-insensitive)
        has_fixes_pattern = (
            re.search(r"[Ff]ixes\s*#", content)
            or "fixes" in content.lower()
        )
        assert has_fixes_pattern, (
            "Workflow must parse 'fixes #N' from PR description"
        )


# ── Each Reviewer Job Steps ──────────────────────────────────────────


class TestReviewerJobSteps:
    """Each reviewer job must: checkout repo, then run claude -p with appropriate skill."""

    def _get_reviewer_jobs(self):
        wf = load_workflow()
        jobs = wf.get("jobs", {})
        return {
            k: v for k, v in jobs.items()
            if "correctness" in k.lower()
            or "test" in k.lower()
            or "architecture" in k.lower()
        }

    def _get_all_steps_content(self, job):
        """Get all step run/script content for a job."""
        parts = []
        for step in job.get("steps", []):
            if "run" in step:
                parts.append(step["run"])
            if step.get("uses", "").startswith("actions/github-script"):
                script = step.get("with", {}).get("script", "")
                parts.append(script)
        return "\n".join(parts)

    def test_each_reviewer_checks_out_repo(self):
        """Each reviewer job must have a checkout step."""
        reviewer_jobs = self._get_reviewer_jobs()
        for job_name, job in reviewer_jobs.items():
            steps = job.get("steps", [])
            checkout = [
                s for s in steps
                if s.get("uses", "").startswith("actions/checkout")
            ]
            assert len(checkout) >= 1, (
                f"Reviewer job '{job_name}' must have a checkout step"
            )

    def test_each_reviewer_runs_claude_p(self):
        """Each reviewer job must run `claude -p` (or `claude --print`)."""
        reviewer_jobs = self._get_reviewer_jobs()
        for job_name, job in reviewer_jobs.items():
            content = self._get_all_steps_content(job)
            has_claude = "claude" in content.lower()
            assert has_claude, (
                f"Reviewer job '{job_name}' must invoke claude"
            )

    def test_correctness_reviewer_references_skill(self):
        """Correctness reviewer must reference the correctness skill."""
        wf = load_workflow()
        jobs = wf.get("jobs", {})
        correctness_jobs = {
            k: v for k, v in jobs.items()
            if "correctness" in k.lower()
        }
        for job_name, job in correctness_jobs.items():
            content = self._get_all_steps_content(job)
            assert "reviewer-correctness" in content or "correctness" in content.lower(), (
                f"Correctness job '{job_name}' must reference the correctness reviewer skill"
            )

    def test_tests_reviewer_references_skill(self):
        """Tests reviewer must reference the test reviewer skill."""
        wf = load_workflow()
        jobs = wf.get("jobs", {})
        test_jobs = {
            k: v for k, v in jobs.items()
            if "test" in k.lower()
        }
        for job_name, job in test_jobs.items():
            content = self._get_all_steps_content(job)
            assert "reviewer-tests" in content or "test" in content.lower(), (
                f"Tests job '{job_name}' must reference the test reviewer skill"
            )

    def test_architecture_reviewer_references_skill(self):
        """Architecture reviewer must reference the architecture reviewer skill."""
        wf = load_workflow()
        jobs = wf.get("jobs", {})
        arch_jobs = {
            k: v for k, v in jobs.items()
            if "architecture" in k.lower()
        }
        for job_name, job in arch_jobs.items():
            content = self._get_all_steps_content(job)
            assert "reviewer-architecture" in content or "architecture" in content.lower(), (
                f"Architecture job '{job_name}' must reference the architecture reviewer skill"
            )


# ── Context Passing ──────────────────────────────────────────────────


class TestContextPassing:
    """Each reviewer must receive PR number, parent issue number, and repo info."""

    def _get_all_content(self):
        """Get all run/script/env content from all jobs."""
        wf = load_workflow()
        parts = []
        for job_name, job in wf.get("jobs", {}).items():
            # Job-level env
            for v in job.get("env", {}).values():
                if isinstance(v, str):
                    parts.append(v)
            for step in job.get("steps", []):
                if "run" in step:
                    parts.append(step["run"])
                if step.get("uses", "").startswith("actions/github-script"):
                    parts.append(step.get("with", {}).get("script", ""))
                for v in step.get("env", {}).values():
                    if isinstance(v, str):
                        parts.append(v)
        return "\n".join(parts)

    def test_passes_pr_number(self):
        content = self._get_all_content()
        # Should reference pull_request number or PR number
        has_pr_num = (
            "pull_request" in content
            or "pr_number" in content.lower()
            or "pr-number" in content.lower()
            or "PR_NUMBER" in content
        )
        assert has_pr_num, (
            "Workflow must pass PR number to reviewer"
        )

    def test_passes_parent_issue_number(self):
        content = self._get_all_content()
        has_parent = (
            "parent" in content.lower()
            or "issue" in content.lower()
            or "PARENT_ISSUE" in content
        )
        assert has_parent, (
            "Workflow must pass parent issue number to reviewer"
        )

    def test_passes_repo_info(self):
        content = self._get_all_content()
        has_repo = (
            "github.repository" in content
            or "repo.owner" in content
            or "GITHUB_REPOSITORY" in content
            or "context.repo" in content
        )
        assert has_repo, (
            "Workflow must pass repo owner/name to reviewer"
        )


# ── Reviewer Prompt Content ──────────────────────────────────────────


class TestReviewerPromptContent:
    """The prompt passed to claude -p must instruct the reviewer correctly."""

    def _get_all_content(self):
        wf = load_workflow()
        parts = []
        for job_name, job in wf.get("jobs", {}).items():
            for v in job.get("env", {}).values():
                if isinstance(v, str):
                    parts.append(v)
            for step in job.get("steps", []):
                if "run" in step:
                    parts.append(step["run"])
                if step.get("uses", "").startswith("actions/github-script"):
                    parts.append(step.get("with", {}).get("script", ""))
                for v in step.get("env", {}).values():
                    if isinstance(v, str):
                        parts.append(v)
        return "\n".join(parts)

    def test_prompt_instructs_reading_pr_diff(self):
        content = self._get_all_content()
        assert "diff" in content.lower(), (
            "Reviewer prompt must instruct reading the PR diff"
        )

    def test_prompt_instructs_creating_issues(self):
        content = self._get_all_content()
        has_issue_create = (
            "gh issue create" in content
            or "issue" in content.lower()
        )
        assert has_issue_create, (
            "Reviewer prompt must instruct creating child issues for findings"
        )

    def test_prompt_includes_severity_labels(self):
        content = self._get_all_content()
        assert "blocking" in content, (
            "Prompt must mention 'blocking' severity label"
        )
        assert "should-fix" in content, (
            "Prompt must mention 'should-fix' severity label"
        )
        assert "suggestion" in content, (
            "Prompt must mention 'suggestion' severity label"
        )

    def test_prompt_instructs_sub_issue_linking(self):
        content = self._get_all_content()
        has_sub_issue = (
            "sub-issue" in content.lower()
            or "sub_issue" in content.lower()
            or "subissue" in content.lower()
            or "addSubIssue" in content
            or "child" in content.lower()
        )
        assert has_sub_issue, (
            "Prompt must instruct linking findings as sub-issues of parent"
        )

    def test_prompt_instructs_blocking_dependency(self):
        content = self._get_all_content()
        has_blocking = (
            "blocking" in content.lower()
            and ("dependency" in content.lower()
                 or "blocked_by" in content.lower()
                 or "blocked-by" in content.lower()
                 or "block" in content.lower())
        )
        assert has_blocking, (
            "Prompt must instruct setting blocking dependencies for blocking findings"
        )


# ── Secrets ──────────────────────────────────────────────────────────


class TestSecrets:
    """Workflow must use ANTHROPIC_API_KEY secret for claude -p."""

    def _get_all_content(self):
        wf = load_workflow()
        parts = []
        for job_name, job in wf.get("jobs", {}).items():
            for v in job.get("env", {}).values():
                if isinstance(v, str):
                    parts.append(v)
            for step in job.get("steps", []):
                if "run" in step:
                    parts.append(step["run"])
                for v in step.get("env", {}).values():
                    if isinstance(v, str):
                        parts.append(v)
        return "\n".join(parts)

    def test_references_anthropic_api_key(self):
        content = self._get_all_content()
        assert "ANTHROPIC_API_KEY" in content, (
            "Workflow must reference ANTHROPIC_API_KEY secret for claude -p"
        )


# ── Resolve Context Job ───────────────────────────────────────────────


class TestResolveContextJob:
    """The resolve-context job extracts PR metadata for reviewer jobs."""

    def _get_context_job(self):
        wf = load_workflow()
        jobs = wf.get("jobs", {})
        ctx_jobs = {
            k: v for k, v in jobs.items()
            if "context" in k.lower() or "resolve" in k.lower()
        }
        assert len(ctx_jobs) >= 1, (
            "Must have a resolve-context job to extract PR metadata"
        )
        return list(ctx_jobs.values())[0]

    def test_resolve_context_job_exists(self):
        self._get_context_job()

    def test_resolve_context_has_outputs(self):
        job = self._get_context_job()
        outputs = job.get("outputs", {})
        assert len(outputs) >= 2, (
            "resolve-context job must export outputs (at least pr-number and parent-issue)"
        )

    def test_resolve_context_outputs_pr_number(self):
        job = self._get_context_job()
        outputs = job.get("outputs", {})
        has_pr = any("pr" in k.lower() for k in outputs.keys())
        assert has_pr, (
            "resolve-context must output a PR number"
        )

    def test_resolve_context_outputs_parent_issue(self):
        job = self._get_context_job()
        outputs = job.get("outputs", {})
        has_parent = any(
            "parent" in k.lower() or "issue" in k.lower()
            for k in outputs.keys()
        )
        assert has_parent, (
            "resolve-context must output a parent issue number"
        )

    def test_reviewer_jobs_depend_on_context(self):
        """All reviewer jobs must depend on the resolve-context job."""
        wf = load_workflow()
        jobs = wf.get("jobs", {})
        # Find the context job key
        ctx_key = None
        for k in jobs:
            if "context" in k.lower() or "resolve" in k.lower():
                ctx_key = k
                break
        assert ctx_key is not None

        reviewer_keys = [
            k for k in jobs
            if "correctness" in k.lower()
            or "test" in k.lower()
            or "architecture" in k.lower()
        ]
        for key in reviewer_keys:
            needs = jobs[key].get("needs", [])
            if isinstance(needs, str):
                needs = [needs]
            assert ctx_key in needs, (
                f"Reviewer job '{key}' must depend on '{ctx_key}'"
            )

    def test_reviewer_jobs_skip_when_no_parent_issue(self):
        """Reviewer jobs should have an 'if' condition to skip when no parent issue."""
        wf = load_workflow()
        jobs = wf.get("jobs", {})
        reviewer_keys = [
            k for k in jobs
            if "correctness" in k.lower()
            or "test" in k.lower()
            or "architecture" in k.lower()
        ]
        for key in reviewer_keys:
            job_if = jobs[key].get("if", "")
            assert "parent" in job_if.lower() or "issue" in job_if.lower(), (
                f"Reviewer job '{key}' must have an 'if' condition checking for parent issue"
            )

    def test_handles_workflow_dispatch(self):
        """Resolve-context must handle both pull_request and workflow_dispatch events."""
        job = self._get_context_job()
        steps_content = []
        for step in job.get("steps", []):
            if "run" in step:
                steps_content.append(step["run"])
            if step.get("uses", "").startswith("actions/github-script"):
                steps_content.append(step.get("with", {}).get("script", ""))
        content = "\n".join(steps_content)
        assert "workflow_dispatch" in content, (
            "resolve-context must handle workflow_dispatch event"
        )


# ── Config Reading ───────────────────────────────────────────────────


class TestConfigReading:
    """Workflow should read config.yaml for settings like re-review-cycle-cap."""

    def test_config_has_re_review_cycle_cap(self):
        config = load_config()
        assert "re-review-cycle-cap" in config, (
            "Config must have 're-review-cycle-cap' setting"
        )

    def test_re_review_cycle_cap_default(self):
        config = load_config()
        assert config["re-review-cycle-cap"] == 3, (
            "Default re-review-cycle-cap should be 3"
        )
