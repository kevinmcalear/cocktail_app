export const COCKTAIL_ORIGIN_OPTIONS = [
    { id: "Modern Classic", name: "Modern Classic" },
    { id: "Classic", name: "Classic" },
    { id: "Original", name: "Original" },
    { id: "Varient", name: "Varient" },
] as const;

export function buildOriginOptions(current?: string | null): { id: string; name: string }[] {
    const options: { id: string; name: string }[] = [...COCKTAIL_ORIGIN_OPTIONS];
    if (current && !options.some((o) => o.id === current)) {
        options.unshift({ id: current, name: current });
    }
    return options;
}
