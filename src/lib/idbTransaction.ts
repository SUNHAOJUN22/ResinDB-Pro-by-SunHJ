/** idb creates tx.done when wrapping a transaction, separately from requests.
 * Observe it before the first await, then abort/drain on request failure while
 * preserving that request's original error. Publish caches only after return.
 */
export async function completeTransaction<T>(transaction: { done: Promise<unknown>; abort(): void }, requests: () => Promise<T>): Promise<T> {
  const completion = transaction.done;
  void completion.catch(() => undefined);
  try {
    const result = await requests();
    await completion;
    return result;
  } catch (error) {
    try { transaction.abort(); } catch { /* A failed request can already have aborted it. */ }
    await completion.catch(() => undefined);
    throw error;
  }
}
