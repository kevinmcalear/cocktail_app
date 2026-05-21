/**
 * Capitalizes the first letter of each word in a string, 
 * keeping acronyms/abbreviations in uppercase, and correcting minor case anomalies.
 */
export function capitalize(str: string | null | undefined): string {
    if (!str) return '';
    
    return str
        .trim()
        .split(/\s+/)
        .map(word => {
            if (!word) return '';
            
            // If the word contains hyphens (like "st-germain"), capitalize each part
            if (word.includes('-')) {
                return word
                    .split('-')
                    .map(part => capitalizePart(part))
                    .join('-');
            }
            
            // If the word contains slashes (like "sweet/sour"), capitalize each part
            if (word.includes('/')) {
                return word
                    .split('/')
                    .map(part => capitalizePart(part))
                    .join('/');
            }
            
            return capitalizePart(word);
        })
        .join(' ');
}

function capitalizePart(word: string): string {
    if (!word) return '';
    
    // Keep acronyms/abbreviations in uppercase (2-4 uppercase letters, e.g. IPA, ABV, VSOP, XO, OZ, ML)
    const isAcronym = /^[A-Z]{2,4}$/.test(word);
    if (isAcronym) {
        return word;
    }
    
    // Otherwise, capitalize first letter and lowercase the rest (e.g. "EVery" -> "Every")
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Capitalizes string as you type, preserving whitespace so cursor doesn't jump.
 */
export function capitalizeAsYouType(str: string | null | undefined): string {
    if (!str) return '';
    
    return str
        .split(/(\s+)/)
        .map(part => {
            if (!part) return '';
            if (/^\s+$/.test(part)) return part; // Keep spaces exactly as they are
            
            // If the word contains hyphens, capitalize each part
            if (part.includes('-')) {
                return part
                    .split('-')
                    .map(sub => capitalizePart(sub))
                    .join('-');
            }
            
            // If the word contains slashes, capitalize each part
            if (part.includes('/')) {
                return part
                    .split('/')
                    .map(sub => capitalizePart(sub))
                    .join('/');
            }
            
            return capitalizePart(part);
        })
        .join('');
}

/**
 * Handles text input changes with capitalization, avoiding cursor jumps on deletions.
 */
export function handleCapitalizedChange(
    newVal: string,
    prevVal: string,
    setter: (val: string) => void
) {
    if (newVal.length < prevVal.length) {
        // Deletion occurred - do not format to prevent cursor jumps
        setter(newVal);
    } else {
        // Addition or paste - format it
        setter(capitalizeAsYouType(newVal));
    }
}


