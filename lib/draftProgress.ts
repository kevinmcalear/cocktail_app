export interface ProgressInfo {
    percentage: number;
    color: string;
    label: string;
    badgeBg: string;
    badgeText: string;
    innerDrafts?: any[];
}

function isValueSet(val: any): boolean {
    if (val === undefined || val === null) return false;
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') return false;
        if (trimmed.toLowerCase().startsWith('untitled')) return false;
        return true;
    }
    if (Array.isArray(val)) {
        return val.length > 0;
    }
    return true;
}

export function calculateDraftProgress(
    draft: any,
    drafts: any[],
    dropdowns?: any,
    visited: Set<string> = new Set<string>()
): ProgressInfo {
    if (draft && draft.isPublished) {
        return {
            percentage: 100,
            color: '#34C759', // Green
            label: 'Published',
            badgeBg: 'rgba(52, 199, 89, 0.1)',
            badgeText: '#34C759',
            innerDrafts: []
        };
    }

    if (!draft || !draft.draft_data || !draft.id || visited.has(draft.id)) {
        return {
            percentage: 0,
            color: '#8e8e93',
            label: 'Not Started',
            badgeBg: 'rgba(142, 142, 147, 0.1)',
            badgeText: '#8e8e93'
        };
    }

    visited.add(draft.id);

    const data = draft.draft_data;
    const type = draft.entity_type;
    let percentage = 0;
    const innerDrafts: any[] = [];

    switch (type) {
        case 'ingredient': {
            let score = 0;
            if (isValueSet(data.name)) score += 25;
            if (isValueSet(data.brandMaker)) score += 25;
            if (isValueSet(data.abv)) score += 25;
            if (isValueSet(data.selectedCategories)) score += 25;
            percentage = score;

            // Collect inner draft ingredients from recipe items
            const recipeItems = data.recipeItems || [];
            recipeItems.forEach((item: any) => {
                const childDraft = drafts.find(
                    (d: any) => d.id === item.ingredient_id && d.entity_type === 'ingredient'
                );
                if (childDraft) {
                    innerDrafts.push(childDraft);
                }
            });
            break;
        }
        case 'cocktail': {
            let score = 0;
            if (isValueSet(data.name)) score += 25;
            if (isValueSet(data.description)) score += 25;
            
            // Specs: up to 25% total, 6.25% for each of Glassware, Method, Family, Ice
            let specsScore = 0;
            if (isValueSet(data.glasswareId)) specsScore += 6.25;
            if (isValueSet(data.methodId)) specsScore += 6.25;
            if (isValueSet(data.familyId)) specsScore += 6.25;
            if (isValueSet(data.iceId)) specsScore += 6.25;
            score += Math.round(specsScore * 100) / 100;

            // Recipe: 25% if at least 1 ingredient
            if (isValueSet(data.recipeItems)) score += 25;
            percentage = Math.min(100, Math.round(score));

            // Collect inner draft ingredients from recipe items
            const recipeItems = data.recipeItems || [];
            recipeItems.forEach((item: any) => {
                const childDraft = drafts.find(
                    (d: any) => d.id === item.ingredient_id && d.entity_type === 'ingredient'
                );
                if (childDraft) {
                    innerDrafts.push(childDraft);
                }
            });
            break;
        }
        case 'beer': {
            let score = 0;
            if (isValueSet(data.name)) score += 25;
            if (isValueSet(data.brewery)) score += 25;
            
            // ABV (12.5%) & Price (12.5%)
            if (isValueSet(data.abv)) score += 12.5;
            if (isValueSet(data.price)) score += 12.5;

            // Style tags (25%)
            if (isValueSet(data.selectedCategories)) score += 25;
            
            percentage = Math.min(100, Math.round(score));
            break;
        }
        case 'wine': {
            let score = 0;
            if (isValueSet(data.name)) score += 25;
            if (isValueSet(data.vintner)) score += 25;
            
            // ABV (12.5%) & Price (12.5%)
            if (isValueSet(data.abv)) score += 12.5;
            if (isValueSet(data.price)) score += 12.5;

            // Style tags (25%)
            if (isValueSet(data.selectedCategories)) score += 25;
            
            percentage = Math.min(100, Math.round(score));
            break;
        }
        case 'menu': {
            let score = 0;
            // Template selection is 15%
            const selectedTemplateId = data.selectedTemplateId;
            if (isValueSet(selectedTemplateId)) score += 15;

            // Name is 5%
            if (isValueSet(data.menuName) || isValueSet(data.name)) score += 5;

            // Sections filled satisfying min items requirements is 80%
            let sectionScore = 0;
            const selections = data.selections || {};
            if (selectedTemplateId && dropdowns?.templateSections) {
                const activeSections = dropdowns.templateSections.filter(
                    (s: any) => s.template_id === selectedTemplateId
                );
                if (activeSections.length > 0) {
                    let satisfiedCount = 0;
                    activeSections.forEach((sec: any) => {
                        const minItems = sec.min_items || 1;
                        const count = (selections[sec.id] || []).length;
                        if (count >= minItems) {
                            satisfiedCount++;
                        }
                    });
                    sectionScore = Math.round((satisfiedCount / activeSections.length) * 80);
                } else {
                    sectionScore = 80;
                }
            } else if (Object.keys(selections).length > 0) {
                const sectionsWithItems = Object.values(selections).filter(
                    (arr: any) => Array.isArray(arr) && arr.length > 0
                ).length;
                if (sectionsWithItems > 0) {
                    sectionScore = 40;
                }
            }
            score += sectionScore;
            percentage = Math.min(100, Math.round(score));

            // Collect inner draft drinks from selections
            Object.values(selections).forEach((drinkIds: any) => {
                if (!Array.isArray(drinkIds)) return;
                drinkIds.forEach((drinkId: any) => {
                    let childId = drinkId;
                    let childType = 'cocktail';
                    if (drinkId.startsWith('beer-')) {
                        childId = drinkId.replace('beer-', '');
                        childType = 'beer';
                    } else if (drinkId.startsWith('wine-')) {
                        childId = drinkId.replace('wine-', '');
                        childType = 'wine';
                    }
                    const childDraft = drafts.find(
                        (d: any) => d.id === childId && d.entity_type === childType
                    );
                    if (childDraft) {
                        innerDrafts.push(childDraft);
                    }
                });
            });
            break;
        }
        default:
            percentage = 0;
    }

    // Combine local progress and inner nested drafts progress
    if (innerDrafts.length > 0) {
        let totalInnerPercentage = 0;
        innerDrafts.forEach((childDraft: any) => {
            const childProgress = calculateDraftProgress(childDraft, drafts, dropdowns, visited);
            totalInnerPercentage += childProgress.percentage;
        });
        // Calculate completion based on all associated drafts as well as its own rules (equally weighted)
        percentage = Math.round((percentage + totalInnerPercentage) / (1 + innerDrafts.length));
    }

    // Color mapping along the spectrum
    let color = '#8e8e93';
    let label = 'Not Started';

    if (percentage === 0) {
        color = '#8e8e93';
        label = 'Not Started';
    } else if (percentage <= 25) {
        color = '#ef4444'; // Red
        label = 'In Progress';
    } else if (percentage <= 50) {
        color = '#f97316'; // Orange
        label = 'In Progress';
    } else if (percentage < 75) {
        color = '#eab308'; // Yellow
        label = 'In Progress';
    } else if (percentage < 100) {
        color = '#84cc16'; // Lime
        label = 'Needs Polish';
    } else {
        color = '#10b981'; // Emerald Green
        label = 'Ready';
    }

    // Convert hex color to semi-transparent rgba color for the badge background
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    return {
        percentage,
        color,
        label,
        badgeBg: hexToRgba(color, 0.1),
        badgeText: color,
        innerDrafts
    };
}
