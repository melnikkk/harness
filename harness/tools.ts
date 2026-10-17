import { tool } from 'ai';
import { z } from 'zod';
import { KNOWLEDGE_BASE } from './knowledge-base';

export const tools = {
  searchKnowledgeBase: tool({
    description: 'Search the support knowledge base for relevant articles.',
    inputSchema: z.object({
      query: z.string().describe('what to look up'),
    }),
  }),

  classifyItem: tool({
    description: 'Classify a work item into a category.',
    inputSchema: z.object({
      itemId: z.string(),
      category: z.enum(['billing', 'technical', 'sales', 'other']),
    }),
  }),

  draftReply: tool({
    description: 'Write a draft reply for a work item. Does not send anything.',
    inputSchema: z.object({
      itemId: z.string(),
      message: z.string(),
    }),
  }),

  sendReply: tool({
    description: 'Send the drafted reply to the customer. This really emails them.',
    inputSchema: z.object({
      itemId: z.string(),
      draftId: z.string(),
    }),
  }),
};

export async function runTool(
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'searchKnowledgeBase': {
      const query = String(args?.query ?? '');
      const hits = Object.entries(KNOWLEDGE_BASE)
        .filter(([key]) => query.toLocaleLowerCase().includes(key))
        .map(([, article]) => article);

      return { articles: hits.length ? hits : ['No relevant articles found.'] };
    }
    case 'classifyItem': {
      return { ok: true, itemId: args.itemId, category: args.category };
    }
    case 'draftReply': {
      return { ok: true, draftId: `draft-${args.itemId}` };
    }
    case 'sendReply': {
      return { ok: true, itemId: args.itemId, draftId: args.draftId };
    }
    default: {
      throw new Error(`Unknown tool: ${name}`);
    }
  }
}
