type Charge = {
  id: string;
  amount: number;
  date: string;
  description: string;
};

export const CHARGES: Record<string, Array<Charge>> = {
  cus_88121: [
    {id: 'ch_001', amount: 4900, date: '2026-05-01', description: 'Pro plan — monthly'},
    {id: 'ch_002', amount: 4900, date: '2026-05-01', description: 'Pro plan — monthly'},
    {id: 'ch_003', amount: 1500, date: '2026-04-18', description: 'Extra seats'},
  ],
};