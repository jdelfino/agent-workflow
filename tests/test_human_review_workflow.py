"""
Tests for .github/workflows/human-review.yml

Validates the workflow structure, trigger configuration, permissions,
and the expected logic within the github-script action.
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
    "human-review.yml",
)


@pytest.fixture
def workflow():
    """Load and parse the workflow YAML."""
    with open(WORKFLOW_PATH) as f:
        return yaml.safe_load(f)


# ── Trigger ──────────────────────────────────────────────────────────


class TestTrigger:
    def test_triggers_on_pull_request_review(self, workflow):
        assert "on" in workflow, "Workflow must have an 'on' trigger"
        on = workflow["on"]
        assert "pull_request_review" in on, (
            "Must trigger on pull_request_review event"
        )

    def test_triggers_only_on_submitted(self, workflow):
        pr_review = workflow["on"]["pull_request_review"]
        assert "types" in pr_review, "Must specify types filter"
        assert pr_review["types"] == ["submitted"], (
            "Must trigger only on 'submitted' type"
        )


# ── Permissions ──────────────────────────────────────────────────────


class TestPermissions:
    def test_has_issues_write(self, workflow):
        perms = workflow.get("permissions", {})
        assert perms.get("issues") == "write", (
            "Needs issues:write to create child issues"
        )

    def test_has_pull_requests_write(self, workflow):
        perms = workflow.get("permissions", {})
        assert perms.get("pull-requests") == "write", (
            "Needs pull-requests:write to update PR description"
        )

    def test_has_contents_read(self, workflow):
        perms = workflow.get("permissions", {})
        assert perms.get("contents") == "read", (
            "Needs contents:read for checkout context"
        )


# ── Jobs ─────────────────────────────────────────────────────────────


class TestJobs:
    def test_has_process_review_job(self, workflow):
        assert "jobs" in workflow, "Workflow must define jobs"
        assert "process-review" in workflow["jobs"], (
            "Must have a 'process-review' job"
        )

    def test_job_runs_on_ubuntu(self, workflow):
        job = workflow["jobs"]["process-review"]
        assert "ubuntu" in job["runs-on"], "Job must run on ubuntu"

    def test_job_has_steps(self, workflow):
        job = workflow["jobs"]["process-review"]
        assert "steps" in job, "Job must have steps"
        assert len(job["steps"]) > 0, "Job must have at least one step"


# ── Script Content ───────────────────────────────────────────────────


class TestScriptContent:
    """Validate the github-script step contains the required logic."""

    @pytest.fixture
    def script_step(self, workflow):
        """Find the github-script step."""
        steps = workflow["jobs"]["process-review"]["steps"]
        for step in steps:
            if step.get("uses", "").startswith("actions/github-script"):
                return step
        pytest.fail("No actions/github-script step found")

    @pytest.fixture
    def script_text(self, script_step):
        """Extract the script text from the github-script step."""
        return script_step.get("with", {}).get("script", "")

    def test_uses_github_script_v7(self, script_step):
        assert script_step["uses"] == "actions/github-script@v7"

    def test_parses_fixes_reference(self, script_text):
        assert re.search(r"[Ff]ixes\s*#", script_text), (
            "Script must parse 'Fixes #N' from PR body"
        )

    def test_fetches_review_comments(self, script_text):
        # Should call the reviews/comments endpoint
        assert "reviews" in script_text and "comments" in script_text, (
            "Script must fetch review comments"
        )

    def test_creates_issues(self, script_text):
        assert "issues.create" in script_text or "createIssue" in script_text, (
            "Script must create issues for review comments"
        )

    def test_severity_detection_blocking(self, script_text):
        assert "blocking" in script_text.lower() or "block" in script_text.lower(), (
            "Script must detect blocking severity"
        )

    def test_severity_detection_suggestion(self, script_text):
        assert "suggestion" in script_text.lower(), (
            "Script must detect suggestion severity"
        )

    def test_severity_detection_should_fix(self, script_text):
        assert "should-fix" in script_text or "should_fix" in script_text, (
            "Script must handle should-fix severity"
        )

    def test_includes_file_path_context(self, script_text):
        assert "path" in script_text, (
            "Script must include file path from comment location"
        )

    def test_includes_line_number_context(self, script_text):
        # Should reference line from the comment
        assert "line" in script_text, (
            "Script must include line number from comment location"
        )

    def test_graphql_sub_issue_linking(self, script_text):
        assert "addSubIssue" in script_text, (
            "Script must use addSubIssue GraphQL mutation to link child issues"
        )

    def test_graphql_parent_node_id(self, script_text):
        assert "node_id" in script_text or "nodeId" in script_text or "node id" in script_text.lower(), (
            "Script must get parent issue node ID for GraphQL"
        )

    def test_updates_pr_body_with_fixes(self, script_text):
        # Should update the PR body/description to add Fixes references
        assert "update" in script_text.lower() and ("body" in script_text or "description" in script_text), (
            "Script must update PR body with Fixes references for created issues"
        )

    def test_blocking_dependency_api(self, script_text):
        # Should use the sub-issues dependency blocked-by API for blocking comments
        assert "blocked" in script_text.lower() or "dependencies" in script_text.lower() or "blocking" in script_text.lower(), (
            "Script must set blocking dependencies for blocking comments"
        )

    def test_idempotent_pr_body_update(self, script_text):
        """Should replace existing review section rather than duplicating it."""
        assert "human-review-issues-start" in script_text, (
            "Script must use HTML comment markers for idempotent PR body updates"
        )
        assert "human-review-issues-end" in script_text, (
            "Script must use closing HTML comment marker"
        )
        # Check for replacement logic (regex test or replace)
        assert "replace" in script_text.lower() or "test" in script_text, (
            "Script must check for existing section before appending"
        )


# ── Early-exit guard ─────────────────────────────────────────────────


class TestEarlyExit:
    """Verify the workflow handles edge cases gracefully."""

    @pytest.fixture
    def script_text(self, workflow):
        steps = workflow["jobs"]["process-review"]["steps"]
        for step in steps:
            if step.get("uses", "").startswith("actions/github-script"):
                return step.get("with", {}).get("script", "")
        return ""

    def test_skips_when_no_fixes_reference(self, script_text):
        """Should exit early if no 'Fixes #N' found in PR body."""
        assert "no parent issue" in script_text.lower() or "skip" in script_text.lower() or "return" in script_text, (
            "Script must handle case where PR has no Fixes reference"
        )

    def test_skips_when_no_comments(self, script_text):
        """Should handle reviews with no line-level comments."""
        # The script should check if there are comments and handle empty case
        assert "length" in script_text or "no comments" in script_text.lower() or ".length" in script_text, (
            "Script must handle case where review has no comments"
        )


# ── YAML validity ────────────────────────────────────────────────────


class TestYamlValidity:
    def test_yaml_parses_successfully(self):
        """The workflow file must be valid YAML."""
        with open(WORKFLOW_PATH) as f:
            data = yaml.safe_load(f)
        assert data is not None

    def test_is_valid_github_actions_workflow(self, workflow):
        """Must have the basic structure of a GitHub Actions workflow."""
        assert "name" in workflow, "Workflow must have a name"
        assert "on" in workflow, "Workflow must have triggers"
        assert "jobs" in workflow, "Workflow must have jobs"
