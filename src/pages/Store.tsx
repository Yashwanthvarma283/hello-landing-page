import { useEffect, useMemo, useState } from 'react';
import { Coins, ShoppingBag, Check, Loader2, Package, Sparkles, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useUser } from '@/lib/user-context';
import { fetchStoreItems, fetchBalance, purchaseItem, type StoreItem, type CoinBalance } from '@/lib/coins';
import { useActiveEffects } from '@/lib/active-effects';
import { supabase } from '@/integrations/supabase/client';

function timeLeft(expires: string | null, fallbackDays = 7) {
  // All store items are time-limited. If somehow expires is null, treat as fallback window.
  const target = expires ? new Date(expires).getTime() : Date.now() + fallbackDays * 86400000;
  const ms = target - Date.now();
  if (ms <= 0) return 'Expired';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function durationLabel(meta: any) {
  const d = Number(meta?.duration_days);
  const h = Number(meta?.duration_hours);
  if (d) return `Active ${d} day${d > 1 ? 's' : ''} after equipping`;
  if (h) return `Active ${h} hour${h > 1 ? 's' : ''} after equipping`;
  if (meta?.consumable) return 'One-time use';
  return 'Limited time';
}

interface OwnedRow { item_slug: string; equipped: boolean; expires_at: string | null; quantity: number; }

export default function Store() {
  const { authUser } = useUser();
  const { equip, unequip, refresh: refreshFx } = useActiveEffects();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [balance, setBalance] = useState<CoinBalance>({ balance: 0, lifetime_earned: 0, lifetime_spent: 0 });
  const [owned, setOwned] = useState<Record<string, OwnedRow>>({});
  const [confirm, setConfirm] = useState<StoreItem | null>(null);
  const [buying, setBuying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const refresh = async () => {
    setLoading(true);
    const [it, bal] = await Promise.all([
      fetchStoreItems(),
      authUser ? fetchBalance(authUser.id) : Promise.resolve(null),
    ]);
    setItems(it.filter(i => i.enabled));
    if (bal) setBalance(bal);
    if (authUser) {
      const { data } = await (supabase as any)
        .from('user_inventory')
        .select('item_slug, equipped, expires_at, quantity')
        .eq('user_id', authUser.id);
      const map: Record<string, OwnedRow> = {};
      for (const r of (data ?? []) as OwnedRow[]) map[r.item_slug] = r;
      setOwned(map);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [authUser?.id]);

  const handleBuy = async () => {
    if (!confirm) return;
    setBuying(true);
    const item = confirm;
    const res = await purchaseItem(item.slug);
    setBuying(false);
    if (!res.ok) { toast.error(res.error || 'Purchase failed'); return; }
    setConfirm(null);
    // Auto-equip cosmetics & power-ups so the effect is visible immediately.
    const consumable = (item.meta as any)?.consumable;
    if (!consumable) {
      const r = await equip(item.slug);
      if (r.ok) toast.success(`Purchased ${item.name} — equipped & active now`);
      else toast.success(`Purchased ${item.name}`);
    } else {
      toast.success(`Purchased ${item.name}`);
    }
    await refresh();
    await refreshFx();
  };

  const handleEquip = async (slug: string, currentlyEquipped: boolean) => {
    const r = currentlyEquipped ? await unequip(slug) : await equip(slug);
    if (!r.ok) { toast.error(r.error || 'Action failed'); return; }
    toast.success(currentlyEquipped ? 'Unequipped' : 'Equipped — effect active now');
    refresh();
  };

  const grouped = useMemo(() => items.reduce<Record<string, StoreItem[]>>((acc, it) => {
    (acc[it.category] ||= []).push(it);
    return acc;
  }, {}), [items]);

  const inventory = useMemo(() => {
    return items
      .filter(it => owned[it.slug])
      .map(it => ({ item: it, row: owned[it.slug] }));
  }, [items, owned]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" /> Store
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cosmetics last 7 days · XP Boost 24h (2× coins) · Streak Freeze 48h · Equip from your inventory.
          </p>
        </div>
        <div data-coin-badge className="inline-flex items-center gap-2 px-3 h-10 rounded-md border border-border bg-card">
          <Coins className="h-4 w-4 text-amber-500" />
          <span className="font-semibold tabular-nums">{balance.balance.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">coins</span>
        </div>
      </div>

      <Tabs defaultValue="shop" className="w-full">
        <TabsList>
          <TabsTrigger value="shop"><ShoppingBag className="h-4 w-4 mr-1.5" />Shop</TabsTrigger>
          <TabsTrigger value="inventory"><Package className="h-4 w-4 mr-1.5" />My Items ({inventory.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="space-y-6 mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : Object.entries(grouped).map(([cat, list]) => (
            <section key={cat} className="space-y-3">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{cat}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map(item => {
                  const own = owned[item.slug];
                  const canAfford = balance.balance >= item.price;
                  const expired = own?.expires_at && new Date(own.expires_at) < new Date();
                  return (
                    <Card key={item.id} className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm flex items-center gap-1.5">
                            <span>{item.icon}</span>{item.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</div>
                        </div>
                        {own && !expired && <Badge variant="secondary" className="text-[10px]"><Check className="h-3 w-3 mr-1" />Owned</Badge>}
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                        <span className="inline-flex items-center gap-1 text-sm font-semibold">
                          <Coins className="h-3.5 w-3.5 text-amber-500" /> {item.price}
                        </span>
                        <Button
                          size="sm"
                          variant={own && !expired ? 'outline' : 'default'}
                          disabled={!canAfford}
                          onClick={() => setConfirm(item)}
                        >
                          {own && !expired ? 'Extend' : canAfford ? 'Buy' : 'Need more'}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          {inventory.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No items yet. Buy something from the shop!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {inventory.map(({ item, row }) => {
                const expired = row.expires_at && new Date(row.expires_at) < new Date();
                const consumable = (item.meta as any)?.consumable;
                return (
                  <Card key={item.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          <span>{item.icon}</span>{item.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</div>
                      </div>
                      {row.equipped && !expired && (
                        <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                          <Sparkles className="h-3 w-3 mr-1" />Active
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className={expired ? 'text-destructive' : ''}>
                        {row.equipped || row.expires_at ? timeLeft(row.expires_at) : durationLabel(item.meta)}
                      </span>
                      {consumable && <span className="ml-auto">Qty: {row.quantity}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-border gap-2">
                      {item.slug === 'streak_restore' ? (
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full"
                          disabled={row.quantity < 1}
                          onClick={async () => {
                            const y = new Date(); y.setDate(y.getDate() - 1);
                            const iso = y.toISOString().slice(0, 10);
                            const { error } = await (supabase as any).rpc('consume_streak_restore', { _gap_date: iso });
                            if (error) toast.error(error.message); else { toast.success('Streak restored for yesterday'); refresh(); }
                          }}
                        >
                          {row.quantity < 1 ? 'Used' : `Restore yesterday (${row.quantity} left)`}
                        </Button>
                      ) : consumable ? (
                        <span className="text-xs text-muted-foreground">Used automatically</span>
                      ) : expired ? (
                        <Button size="sm" variant="default" className="w-full" onClick={() => setConfirm(item)}>
                          Re-buy
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant={row.equipped ? 'outline' : 'default'}
                          className="w-full"
                          onClick={() => handleEquip(item.slug, row.equipped)}
                        >
                          {row.equipped ? 'Unequip' : 'Equip'}
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm purchase</DialogTitle>
            <DialogDescription>
              Spend <strong>{confirm?.price}</strong> coins on <strong>{confirm?.name}</strong>?
              Your balance will be {Math.max(0, balance.balance - (confirm?.price ?? 0))} after.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button onClick={handleBuy} disabled={buying}>
              {buying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
