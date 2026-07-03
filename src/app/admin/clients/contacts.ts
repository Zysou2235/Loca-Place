import { prisma } from "@/lib/prisma";

export type Contact = {
  email: string;
  phone: string | null;
  type: "acheteur" | "visiteur"; // acheteur ≥ 1 commande ; visiteur = opt-in seul
  purchases: number;
  totalCents: number;
  boxes: string[]; // noms des box concernées
  hosts: string[]; // noms des hôtes concernés
  firstSeen: Date;
  lastSeen: Date;
};

/**
 * Fichier client : fusionne les emails d'acheteurs (Order.customerEmail,
 * collectés par Stripe au paiement) et les opt-ins voyageurs (Lead, laissés
 * sur la page de la box). Dédupliqué par email, trié du plus récent au plus
 * ancien contact.
 */
export async function buildContacts(): Promise<Contact[]> {
  const [orders, leads] = await Promise.all([
    prisma.order.findMany({
      where: { customerEmail: { not: null } },
      select: {
        customerEmail: true,
        customerPhone: true,
        amountCents: true,
        createdAt: true,
        box: { select: { name: true, host: { select: { name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.lead.findMany({
      select: {
        email: true,
        createdAt: true,
        box: { select: { name: true, host: { select: { name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const byEmail = new Map<string, Contact>();

  const touch = (
    email: string,
    at: Date,
    boxName: string,
    hostName: string
  ): Contact => {
    const key = email.toLowerCase();
    let c = byEmail.get(key);
    if (!c) {
      c = {
        email: key,
        phone: null,
        type: "visiteur",
        purchases: 0,
        totalCents: 0,
        boxes: [],
        hosts: [],
        firstSeen: at,
        lastSeen: at,
      };
      byEmail.set(key, c);
    }
    if (at < c.firstSeen) c.firstSeen = at;
    if (at > c.lastSeen) c.lastSeen = at;
    if (!c.boxes.includes(boxName)) c.boxes.push(boxName);
    if (!c.hosts.includes(hostName)) c.hosts.push(hostName);
    return c;
  };

  for (const o of orders) {
    const c = touch(o.customerEmail!, o.createdAt, o.box.name, o.box.host.name);
    c.type = "acheteur";
    c.purchases += 1;
    c.totalCents += o.amountCents;
    if (o.customerPhone && !c.phone) c.phone = o.customerPhone;
  }
  for (const l of leads) {
    touch(l.email, l.createdAt, l.box.name, l.box.host.name);
  }

  return [...byEmail.values()].sort(
    (a, b) => b.lastSeen.getTime() - a.lastSeen.getTime()
  );
}
