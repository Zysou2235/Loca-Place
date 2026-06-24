/**
 * Sales statistics computed from a set of orders.
 * One order = one product sold, so quantity == number of orders.
 */

export type OrderForStats = {
  productName: string;
  amountCents: number;
  createdAt: Date;
  box: { name: string };
};

export type ProductStat = { name: string; qty: number; revenueCents: number };
export type BoxStat = { name: string; qty: number; revenueCents: number };
export type DayStat = { date: string; label: string; revenueCents: number };

export type SalesStats = {
  count: number;
  revenueCents: number;
  avgCents: number;
  last7Cents: number;
  thisMonthCents: number;
  topProducts: ProductStat[];
  byBox: BoxStat[];
  byDay: DayStat[];
  maxDayCents: number;
};

const DAYS = 14;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function computeStats(orders: OrderForStats[]): SalesStats {
  const count = orders.length;
  const revenueCents = orders.reduce((n, o) => n + o.amountCents, 0);
  const avgCents = count > 0 ? Math.round(revenueCents / count) : 0;

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let last7Cents = 0;
  let thisMonthCents = 0;

  const products = new Map<string, ProductStat>();
  const boxes = new Map<string, BoxStat>();

  for (const o of orders) {
    if (o.createdAt >= sevenDaysAgo) last7Cents += o.amountCents;
    if (o.createdAt >= monthStart) thisMonthCents += o.amountCents;

    const p = products.get(o.productName) ?? {
      name: o.productName,
      qty: 0,
      revenueCents: 0,
    };
    p.qty += 1;
    p.revenueCents += o.amountCents;
    products.set(o.productName, p);

    const b = boxes.get(o.box.name) ?? {
      name: o.box.name,
      qty: 0,
      revenueCents: 0,
    };
    b.qty += 1;
    b.revenueCents += o.amountCents;
    boxes.set(o.box.name, b);
  }

  const topProducts = [...products.values()].sort(
    (a, b) => b.revenueCents - a.revenueCents,
  );
  const byBox = [...boxes.values()].sort(
    (a, b) => b.revenueCents - a.revenueCents,
  );

  // Last 14 days revenue per day (oldest -> newest).
  const byDayMap = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    byDayMap.set(dayKey(d), 0);
  }
  for (const o of orders) {
    const k = dayKey(o.createdAt);
    if (byDayMap.has(k)) byDayMap.set(k, byDayMap.get(k)! + o.amountCents);
  }
  const byDay: DayStat[] = [...byDayMap.entries()].map(([date, revenueCents]) => ({
    date,
    label: new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    }),
    revenueCents,
  }));
  const maxDayCents = Math.max(1, ...byDay.map((d) => d.revenueCents));

  return {
    count,
    revenueCents,
    avgCents,
    last7Cents,
    thisMonthCents,
    topProducts,
    byBox,
    byDay,
    maxDayCents,
  };
}
