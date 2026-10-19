import { McpServer } from '@modelcontextprotocol/server';
import { registerTools } from './tools/index';
import type { McpUserContext } from './types';

export function createMcpServer(user: McpUserContext) {
  const server = new McpServer({ name: 'EdgeBalancer', version: '1.0.0' });
  registerTools(server, user);
  return server;
};