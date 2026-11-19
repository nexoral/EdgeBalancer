import type { StructuredToolInterface } from '@langchain/core/tools';
import type { ToolContext } from './types';
import { collectLbTools } from './lb';
import { collectGatewayTools } from './gateway';
import { searchKnowledgeBaseTool } from './search-knowledge-base.tool';

/** Loading one of these is the model stating it means to change something. */
export const MUTATING_TOOL_NAMES = [
  'create_load_balancer',
  'update_load_balancer',
  'delete_load_balancer',
  'pause_load_balancer',
  'resume_load_balancer',
  'create_gateway',
  'update_gateway',
  'delete_gateway',
  'pause_gateway',
  'resume_gateway',
];

export function collectDomainTools(ctx: ToolContext): StructuredToolInterface[] {
  return [...collectLbTools(ctx), ...collectGatewayTools(ctx), searchKnowledgeBaseTool(ctx)];
}
