// What a collected drink shows: the drink as it is now while the collector
// can still read it, else the memory kept when it was collected
// (collected_items name, bar_name, image_url). Collections are memories:
// they outlive a drink going private or being deleted, but a renamed drink
// or bar shouldn't stay stale while it's readable (database audit, 22 Oct, 2.8).

export interface Memory {
  name: string | null;
  barName: string | null;
  imageUrl: string | null;
}

/** The live drink, field by field over the memory; a field the live drink lacks keeps the memory's. */
export function memoryNow(kept: Memory, live: Partial<Memory> | null | undefined): Memory {
  return {
    name: live?.name ?? kept.name,
    barName: live?.barName ?? kept.barName,
    imageUrl: live?.imageUrl ?? kept.imageUrl,
  };
}
