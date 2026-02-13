/**
 * Parse guardrail configuration from YAML content
 * @param {string} yamlContent - Raw YAML content
 * @param {string} guardrailName - Name of the guardrail (e.g., 'scope-enforcement')
 * @returns {object} - Config object with enabled, conclusion, and optional threshold
 */
function parseGuardrailConfig(yamlContent, guardrailName) {
  const defaults = {
    enabled: true,
    conclusion: 'action_required'
  };

  if (!yamlContent) return defaults;

  // Simple YAML parsing for the guardrail section
  const lines = yamlContent.split('\n');
  let inGuardrails = false;
  let inTarget = false;
  const config = { ...defaults };

  for (const line of lines) {
    // Check if we're entering the guardrails section
    if (/^guardrails:/.test(line)) {
      inGuardrails = true;
      continue;
    }

    // Exit guardrails section if we hit another top-level key
    if (inGuardrails && /^\S/.test(line) && !/^\s+/.test(line) && !/^guardrails:/.test(line)) {
      break;
    }

    // Check if we're entering the target guardrail section
    if (inGuardrails && new RegExp(`^\\s+${guardrailName}:`).test(line)) {
      inTarget = true;
      continue;
    }

    // Exit target section if we hit another guardrail key (at same indentation)
    if (inTarget && /^\s+\S+:/.test(line) && !new RegExp(`^\\s+${guardrailName}:`).test(line)) {
      const currentIndent = line.match(/^(\s+)/)?.[1].length || 0;
      const targetIndent = 2; // Assuming standard 2-space YAML indent
      if (currentIndent <= targetIndent) {
        break;
      }
    }

    // Parse config values
    if (inTarget) {
      const enabledMatch = line.match(/^\s+enabled:\s*(true|false)/);
      if (enabledMatch) {
        config.enabled = enabledMatch[1] === 'true';
      }

      const conclusionMatch = line.match(/^\s+conclusion:\s*(\S+)/);
      if (conclusionMatch) {
        config.conclusion = conclusionMatch[1];
      }

      const thresholdMatch = line.match(/^\s+threshold:\s*([\d.]+)/);
      if (thresholdMatch) {
        config.threshold = parseFloat(thresholdMatch[1]);
      }
    }
  }

  return config;
}

module.exports = { parseGuardrailConfig };
