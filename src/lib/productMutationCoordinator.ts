import type { Product } from '@/types/index';

/** null is a catalog-wide barrier (create/delete/import/restore). */
export type ProductMutationScope = ReadonlyMap<string, readonly string[]> | null;
export interface ProductMutation<T> {
  scope: ProductMutationScope;
  requiredIds?: readonly string[];
  project: (products: Product[]) => Product[];
  write: (confirmed: Product[]) => Promise<T>;
}
interface PendingMutation {
  specification: ProductMutation<unknown>;
  state: 'queued' | 'running' | 'settled';
  succeeded: boolean;
  value?: unknown;
  error?: unknown;
  complete: (error: unknown, value?: unknown) => void;
}

function conflicts(left: ProductMutationScope, right: ProductMutationScope): boolean {
  if (left === null || right === null) return true;
  for (const [id, fields] of left) {
    const others = right.get(id);
    if (others && fields.some(field => others.some(other => field === '*' || other === '*'
      || field === other || field.startsWith(`${other}/`) || other.startsWith(`${field}/`)))) return true;
  }
  return false;
}

/** Owns confirmed storage state separately from the UI projection. The public
 * UI setter is deliberately not a source of confirmed records. Conflicts wait
 * for authoritative readback; disjoint scoped patches can run concurrently.
 */
export class ProductMutationCoordinator {
  private confirmed: Product[] = [];
  private pending: PendingMutation[] = [];
  private readFlight: Promise<void> | null = null;
  private readAgain = false;
  private blocked: Error | null = null;

  constructor(private readonly read: () => Promise<Product[]>, private readonly display: (products: Product[]) => void) {}

  snapshot(): Product[] { return this.confirmed; }

  private publish(): void {
    this.display(this.pending.reduce((products, task) => task.specification.project(products), this.confirmed));
  }

  requireIds(ids: readonly string[]): void {
    const known = new Set(this.confirmed.map(product => product.id));
    if (!ids.length || ids.some(id => !known.has(id))) throw new Error('PRODUCT_NOT_CONFIRMED: refresh the catalog before writing this identity');
  }

  run<T>(specification: ProductMutation<T>): Promise<T> {
    if (this.blocked) return Promise.reject(this.blocked);
    try { if (specification.requiredIds) this.requireIds(specification.requiredIds); }
    catch (error) { return Promise.reject(error); }
    return new Promise<T>((resolve, reject) => {
      let completed = false;
      const task: PendingMutation = {
        specification, state: 'queued', succeeded: false,
        complete: (error, value) => {
          if (completed) return;
          completed = true;
          if (error !== undefined) reject(error); else resolve(value as T);
        },
      };
      this.pending.push(task);
      try { this.publish(); }
      catch (error) {
        this.pending = this.pending.filter(item => item !== task);
        reject(error);
        return;
      }
      this.schedule();
    });
  }

  private schedule(): void {
    if (this.blocked) return;
    for (let index = 0; index < this.pending.length; index++) {
      const task = this.pending[index];
      if (task.state !== 'queued') continue;
      if (this.pending.slice(0, index).some(previous => conflicts(previous.specification.scope, task.specification.scope))) continue;
      task.state = 'running';
      void Promise.resolve().then(async () => {
        if (task.specification.requiredIds) this.requireIds(task.specification.requiredIds);
        return task.specification.write(this.confirmed);
      }).then(value => {
        task.succeeded = true;
        task.value = value;
      }, error => { task.error = error; }).then(() => {
        task.state = 'settled';
        if (this.blocked) task.complete(this.blocked);
        else void this.refresh().catch(() => undefined); // Error is delivered to each affected writer.
      });
    }
  }

  /** A read only acknowledges writes already settled at its start. A newer
   * completion stays projected until a later read, even if this older response
   * arrives after it. This prevents old snapshots from erasing newer writes.
   */
  refresh(): Promise<void> {
    if (this.readFlight) {
      this.readAgain = true;
      return this.readFlight;
    }
    this.readFlight = this.reconcile().finally(() => {
      this.readFlight = null;
      // A writer can settle after the loop's final condition but before this
      // promise's finally callback. Its read request still needs servicing.
      if (!this.blocked && (this.readAgain || this.pending.some(task => task.state === 'settled'))) void this.refresh().catch(() => undefined);
    });
    return this.readFlight;
  }

  private async reconcile(): Promise<void> {
    try {
      do {
        this.readAgain = false;
        const frontier = new Set(this.pending.filter(task => task.state === 'settled'));
        const products = await this.read();
        this.confirmed = products;
        this.blocked = null;
        this.pending = this.pending.filter(task => !frontier.has(task));
        this.publish();
        for (const task of frontier) task.complete(task.succeeded ? undefined : task.error ?? new Error('PRODUCT_WRITE_FAILED'), task.value);
        this.schedule();
        if (this.pending.some(task => task.state === 'settled')) this.readAgain = true;
      } while (this.readAgain);
    } catch (error) {
      this.blocked = new Error('PRODUCT_RECONCILIATION_REQUIRED: storage readback failed; refresh successfully before further writes', { cause: error });
      for (const task of this.pending) {
        if (task.state !== 'running') task.complete(this.blocked);
      }
      // Queued writes have never touched storage. Settled writes remain visible
      // as unconfirmed intents until a successful recovery read resolves them.
      this.pending = this.pending.filter(task => task.state !== 'queued');
      this.publish();
      throw this.blocked;
    }
  }
}
