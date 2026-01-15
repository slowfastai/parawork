/**
 * Property-based tests for agent command mapping
 * 
 * **Property 1: Agent Command Mapping**
 * For any agent type in the configuration, when a session is created with that agent type,
 * the system SHALL spawn a process using the command and default arguments specified
 * in the configuration for that agent type.
 * 
 * **Validates: Requirements 1.1, 1.2, 4.1, 4.3**
 * 
 * Feature: auto-launch-cli-session, Property 1: Agent Command Mapping
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getAgentCommand, isValidAgentConfig, getEnabledAgentTypes } from './agentCommand.js';
import type { AgentType, AgentConfig, Config } from '@parawork/shared';

// Arbitrary for generating valid agent commands (alphanumeric with dashes/underscores)
const validCommandArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-z][a-z0-9_-]*$/i.test(s));

// Arbitrary for generating command arguments
const argsArb = fc.array(
  fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-z0-9_-]+$/i.test(s)),
  { minLength: 0, maxLength: 5 }
);

// Arbitrary for generating valid agent config
const validAgentConfigArb: fc.Arbitrary<AgentConfig> = fc.record({
  enabled: fc.boolean(),
  command: validCommandArb,
  defaultArgs: argsArb,
});

// Arbitrary for generating agent type
const agentTypeArb: fc.Arbitrary<AgentType> = fc.constantFrom('claude-code', 'codex');

// Arbitrary for generating a config with agents
const configWithAgentsArb: fc.Arbitrary<Config> = fc.record({
  server: fc.constant({
    port: 3000,
    host: '0.0.0.0',
    cors: { enabled: true, origins: ['http://localhost:5173'] },
  }),
  database: fc.constant({ path: './data/test.db' }),
  agents: fc.record({
    'claude-code': validAgentConfigArb,
    'codex': validAgentConfigArb,
  }),
  tunnel: fc.constant({ enabled: false, provider: 'cloudflare', domain: '' }),
  security: fc.constant({ apiKey: 'test-key' }),
  features: fc.constant({ gitIntegration: true, autoCleanup: true }),
});

describe('Agent Command Mapping - Property Tests', () => {
  /**
   * Property 1: Agent Command Mapping
   * For any agent type, verify correct command is used from config
   * **Validates: Requirements 1.1, 1.2, 4.1, 4.3**
   */
  describe('Property 1: Agent Command Mapping', () => {
    it('should return the exact command from config for any enabled agent type', () => {
      fc.assert(
        fc.property(
          configWithAgentsArb,
          agentTypeArb,
          (config, agentType) => {
            const result = getAgentCommand(agentType, config);
            const agentConfig = config.agents[agentType];

            if (agentConfig.enabled && agentConfig.command.trim() !== '') {
              // If agent is enabled and has a command, result should be successful
              expect(result.success).toBe(true);
              // The returned command should exactly match the config
              expect(result.command).toBe(agentConfig.command);
              // The returned args should exactly match the config
              expect(result.args).toEqual(agentConfig.defaultArgs);
            } else if (!agentConfig.enabled) {
              // If agent is disabled, result should fail
              expect(result.success).toBe(false);
              expect(result.error).toContain('not enabled');
            } else {
              // If command is empty, result should fail
              expect(result.success).toBe(false);
              expect(result.error).toContain('no command configured');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return error for unconfigured agent types', () => {
      fc.assert(
        fc.property(
          configWithAgentsArb,
          (config) => {
            // Create a config without the agent type we're looking for
            const modifiedConfig = {
              ...config,
              agents: {} as Record<string, AgentConfig>,
            };

            const result = getAgentCommand('claude-code', modifiedConfig);
            expect(result.success).toBe(false);
            expect(result.error).toContain('not configured');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve command and args exactly as configured', () => {
      fc.assert(
        fc.property(
          validCommandArb,
          argsArb,
          agentTypeArb,
          (command, args, agentType) => {
            const config: Config = {
              server: { port: 3000, host: '0.0.0.0', cors: { enabled: true, origins: [] } },
              database: { path: './data/test.db' },
              agents: {
                'claude-code': { enabled: true, command: 'claude', defaultArgs: [] },
                'codex': { enabled: true, command: 'codex', defaultArgs: [] },
                [agentType]: { enabled: true, command, defaultArgs: args },
              },
              tunnel: { enabled: false, provider: 'cloudflare', domain: '' },
              security: { apiKey: 'test-key' },
              features: { gitIntegration: true, autoCleanup: true },
            };

            const result = getAgentCommand(agentType, config);

            expect(result.success).toBe(true);
            // The returned command should exactly match the configured command
            expect(result.command).toBe(command);
            // The returned args should have the same values as configured
            expect(result.args).toEqual(args);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('isValidAgentConfig', () => {
    it('should validate agent configs correctly for any valid config', () => {
      fc.assert(
        fc.property(
          validAgentConfigArb,
          (agentConfig) => {
            const isValid = isValidAgentConfig(agentConfig);
            // A valid config should pass validation
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject configs with empty commands', () => {
      fc.assert(
        fc.property(
          fc.record({
            enabled: fc.boolean(),
            command: fc.constant(''),
            defaultArgs: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 3 }),
          }),
          (agentConfig) => {
            const isValid = isValidAgentConfig(agentConfig);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('getEnabledAgentTypes', () => {
    it('should return only enabled agent types', () => {
      fc.assert(
        fc.property(
          configWithAgentsArb,
          (config) => {
            const enabledTypes = getEnabledAgentTypes(config);

            // All returned types should be enabled in config
            for (const agentType of enabledTypes) {
              expect(config.agents[agentType].enabled).toBe(true);
            }

            // All enabled types in config should be returned
            for (const [agentType, agentConfig] of Object.entries(config.agents)) {
              if (agentConfig.enabled) {
                expect(enabledTypes).toContain(agentType);
              } else {
                expect(enabledTypes).not.toContain(agentType);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
