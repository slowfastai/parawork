/**
 * Agent command mapping utilities
 * Provides functions to retrieve and validate agent commands from configuration
 * _Requirements: 1.1, 1.2, 4.1, 4.3_
 */
import type { AgentType, AgentConfig, Config } from '@parawork/shared';

/**
 * Result of getting an agent command
 */
export interface AgentCommandResult {
  success: boolean;
  command?: string;
  args?: string[];
  error?: string;
}

/**
 * Get the command and arguments for a given agent type from configuration
 * 
 * @param agentType - The type of agent (e.g., 'claude-code', 'codex')
 * @param config - The application configuration
 * @returns AgentCommandResult with command and args if successful, or error if not
 */
export function getAgentCommand(agentType: AgentType, config: Config): AgentCommandResult {
  const agentConfig = config.agents[agentType];

  if (!agentConfig) {
    return {
      success: false,
      error: `Agent type '${agentType}' is not configured`,
    };
  }

  if (!agentConfig.enabled) {
    return {
      success: false,
      error: `Agent type '${agentType}' is not enabled`,
    };
  }

  if (!agentConfig.command || agentConfig.command.trim() === '') {
    return {
      success: false,
      error: `Agent type '${agentType}' has no command configured`,
    };
  }

  return {
    success: true,
    command: agentConfig.command,
    args: agentConfig.defaultArgs || [],
  };
}

/**
 * Validate that an agent configuration has all required fields
 * 
 * @param agentConfig - The agent configuration to validate
 * @returns true if valid, false otherwise
 */
export function isValidAgentConfig(agentConfig: AgentConfig): boolean {
  return (
    typeof agentConfig.enabled === 'boolean' &&
    typeof agentConfig.command === 'string' &&
    agentConfig.command.trim() !== '' &&
    Array.isArray(agentConfig.defaultArgs)
  );
}

/**
 * Get all enabled agent types from configuration
 * 
 * @param config - The application configuration
 * @returns Array of enabled agent types
 */
export function getEnabledAgentTypes(config: Config): AgentType[] {
  return Object.entries(config.agents)
    .filter(([_, agentConfig]) => agentConfig.enabled)
    .map(([agentType]) => agentType as AgentType);
}
