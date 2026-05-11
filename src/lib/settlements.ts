export type PlayerInput = {
  playerId: string;
  name: string;
  netPnL: number;
};

export type Settlement = {
  fromPlayerId: string;
  fromName: string;
  toPlayerId: string;
  toName: string;
  amount: number;
};

/**
 * Minimum cash flow algorithm: greedy largest-debtor-pays-largest-creditor.
 * Produces at most N-1 transactions for N players, often fewer.
 * Precondition: sum of all netPnL values must equal 0 (caller is responsible).
 */
export function computeSettlements(players: PlayerInput[]): Settlement[] {
  const creditors = players
    .filter((p) => p.netPnL > 0)
    .map((p) => ({ ...p }))
    .sort((a, b) => b.netPnL - a.netPnL);

  const debtors = players
    .filter((p) => p.netPnL < 0)
    .map((p) => ({ ...p }))
    .sort((a, b) => a.netPnL - b.netPnL);

  const settlements: Settlement[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.netPnL, -debtor.netPnL);

    settlements.push({
      fromPlayerId: debtor.playerId,
      fromName: debtor.name,
      toPlayerId: creditor.playerId,
      toName: creditor.name,
      amount,
    });

    creditor.netPnL -= amount;
    debtor.netPnL += amount;

    if (creditor.netPnL === 0) ci++;
    if (debtor.netPnL === 0) di++;
  }

  return settlements;
}
