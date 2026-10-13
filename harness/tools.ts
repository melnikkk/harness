import { tool } from 'ai';
import { z } from 'zod';
import { KNOWLEDGE_BASE } from './knowledge-base';

export const tools = {
  searchKnowledgeBase: tool({
    description: 'Search the support knowledge base for relevant articles.',
    inputSchema: z.object({
      query: z.string().describe('what to look up'),
    }),
    execute: async ({ query }) => {
      const hits = Object.entries(KNOWLEDGE_BASE)
        .filter(([key]) => query.toLocaleLowerCase().includes(key))
        .map(([, article]) => article);

      return { articles: hits.length > 0 ? hits : ['No relevant articles found.'] };
    },
  }),

  classifyItem: tool({
    description: 'Classify a work item into a category.',
    inputSchema: z.object({
      itemId: z.string(),
      category: z.enum(['billing', 'technical', 'sales', 'other']),
    }),
    execute: async ({ itemId, category }) => ({ ok: true, itemId, category }),
  }),

  draftReply: tool({
    description: 'Write a draft reply for a work item. Does not send anything.',
    inputSchema: z.object({
      itemId: z.string(),
      message: z.string(),
    }),
    execute: async ({ itemId }) => ({ ok: true, draftId: `draft-${itemId}` }),
  }),

  sendReply: tool({
    description: 'Send the drafted reply to the customer. This really emails them.',
    inputSchema: z.object({
      itemId: z.string(),
      draftId: z.string(),
    }),
    // DANGEROUS: an irreversible side effect with zero confirmation.
    execute: async ({ itemId, draftId }) => ({ sent: true, itemId, draftId }),
  }),
};
