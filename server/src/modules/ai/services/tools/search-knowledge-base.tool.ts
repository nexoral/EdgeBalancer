import { tool } from '@langchain/core/tools';
import { initKnowledgeBase, collections } from '../../../../config/knowledge';
import { fail, ok } from './shared';
import type { ToolContext } from './types';

export function searchKnowledgeBaseTool(ctx: ToolContext) {
  return tool(
    async (input: any) => {
      const rawQuery = typeof input?.query === 'string' ? input.query.trim() : '';
      if (!rawQuery) {
        return fail('A search query is required.');
      }

      await initKnowledgeBase();

      const requestedCol = typeof input?.collection === 'string' ? input.collection.trim().toLowerCase() : '';
      const limit = typeof input?.limit === 'number' && input.limit > 0 ? Math.min(input.limit, 10) : 5;

      const targetCols = Object.entries(collections).filter(([name, col]) => {
        if (!col) return false;
        return requestedCol ? name.toLowerCase() === requestedCol : true;
      });

      if (targetCols.length === 0) {
        return fail(
          `No matching collection for "${requestedCol}". Available: ${Object.keys(collections).join(', ')}`,
        );
      }

      const runQuery = async (pattern: string) => {
        const matches: Array<{ title: string; description: string }> = [];
        for (const [, col] of targetCols) {
          if (!col || matches.length >= limit) break;

          const res: any = await col
            .query({
              $or: [
                { title: { $regex: pattern, $options: 'i' } },
                { description: { $regex: pattern, $options: 'i' } },
              ],
            })
            .Limit(limit - matches.length)
            .exec();

          const docs = res?.data?.documents || [];
          for (const doc of docs) {
            if (!matches.some((m) => m.title === doc.title)) {
              matches.push({ title: doc.title, description: doc.description });
            }
            if (matches.length >= limit) break;
          }
        }
        return matches;
      };

      try {
        const safeFull = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let results = await runQuery(safeFull);

        if (results.length === 0) {
          const STOP_WORDS = new Set([
            'how', 'can', 'the', 'and', 'for', 'with', 'what', 'are',
            'this', 'that', 'from', 'you', 'your', 'about', 'have', 'does',
          ]);
          const words = rawQuery
            .split(/\s+/)
            .map((w: string) => w.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .filter((w: string) => w.length > 2 && !STOP_WORDS.has(w));

          if (words.length > 0) {
            results = await runQuery(words.join('|'));
          }
        }

        ctx.log.info(`search_knowledge_base "${rawQuery}" → ${results.length} result(s)`);

        return ok({ results });
      } catch (err: any) {
        return fail(`Knowledge base search failed: ${err?.message || 'unknown error'}`);
      }
    },
    {
      name: 'search_knowledge_base',
      description:
        'Search EdgeBalancer knowledge base documentation for architecture, features, plans/quotas, common errors, troubleshooting, and security FAQs.',
      verboseParsingErrors: true,
      schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search keywords or topic (e.g. "409", "jwt", "body shaping", "rate limit quotas").',
          },
          collection: {
            type: 'string',
            description:
              'Optional subcategory to filter: architecture, features, edge_infrastructure, tiers, quotas_and_limits, feature_matrix, common_errors, troubleshooting, security_faqs.',
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of results to return (default 5, max 10).',
            minimum: 1,
            maximum: 10,
          },
        },
        required: ['query'],
      },
    },
  );
}
