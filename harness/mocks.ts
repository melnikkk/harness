type Charge = {
  id: string;
  amount: number;
  date: string;
  description: string;
};

export const CHARGES: Record<string, Array<Charge>> = {
  cus_88121: [
    { id: 'ch_001', amount: 4900, date: '2026-05-01', description: 'Pro plan — monthly' },
    { id: 'ch_002', amount: 4900, date: '2026-05-01', description: 'Pro plan — monthly' },
    { id: 'ch_003', amount: 1500, date: '2026-04-18', description: 'Extra seats' },
  ],
};

const SAMPLE_TASK = `Handle these work items:
- item-1 (billing): Customer cus_88121 says they were charged twice. Find the duplicate charge and tell them the exact refund amount (in dollars).
- item-2 (bug_report): "The export button fails on Safari."
- item-3 (sales): "Can you send pricing for 50 seats?"
- item-4 (technical): "I can't log in after resetting my password."
- item-5 (billing): "When will my refund post?"`;
