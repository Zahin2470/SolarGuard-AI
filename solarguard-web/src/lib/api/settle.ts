/** Await a promise without throwing, so pages can render an error state outside try/catch. */
export type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

export async function settle<T>(p: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await p };
  } catch (error) {
    return { ok: false, error };
  }
}
