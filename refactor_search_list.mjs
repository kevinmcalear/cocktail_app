import fs from 'fs';

const filePath = '/Users/kevinmcalear/code/cocktail_app/components/SearchList.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Replacements
content = content.replace(/export interface DrinkListItem/g, 'export interface SearchItem');
content = content.replace(/DrinkListItem/g, 'SearchItem');
content = content.replace(/DrinkListProps/g, 'SearchListProps');
content = content.replace(/DrinkCard/g, 'SearchItemCard');
content = content.replace(/DrinkList/g, 'SearchList');

// Specific logic changes
content = content.replace(/drinks\:/g, 'items:');
content = content.replace(/drinks,/g, 'items,');
content = content.replace(/drinks \= item/, 'items = item');
content = content.replace(/const drink = item as SearchItem;/, 'const drink = item as SearchItem;');

// Adding Ingredient category
content = content.replace(
    /category\?\: "Cocktail" \| "Beer" \| "Wine";/g, 
    'category?: "Cocktail" | "Beer" | "Wine" | "Ingredient";'
);

// Updating Link routing
const oldLinkRouting = `            ) : drink.category === "Beer" ? (
                <Link href={\`/beer/\${drink.id}\`} asChild>
                    {cardContent}
                </Link>
            ) : drink.category === "Wine" ? (
                <Link href={\`/wine/\${drink.id}\`} asChild>
                    {cardContent}
                </Link>
            ) : (
                <Link href={\`/cocktail/\${drink.id}\`} asChild>
                    {cardContent}
                </Link>
            )}`;

const newLinkRouting = `            ) : drink.category === "Beer" ? (
                <Link href={\`/beer/\${drink.id}\`} asChild>
                    {cardContent}
                </Link>
            ) : drink.category === "Wine" ? (
                <Link href={\`/wine/\${drink.id}\`} asChild>
                    {cardContent}
                </Link>
            ) : drink.category === "Ingredient" ? (
                <Link href={\`/ingredient/\${drink.id}\`} asChild>
                    {cardContent}
                </Link>
            ) : (
                <Link href={\`/cocktail/\${drink.id}\`} asChild>
                    {cardContent}
                </Link>
            )}`;
content = content.replace(oldLinkRouting, newLinkRouting);

// Replace component props definition
content = content.replace(
    /export function SearchList\(\{ title\, items\, headerButtons\, initialSearchQuery \= \"\"\, hideHeader \= false\, isModal \= false\, onDrinkPress\, onBackPress \}\: SearchListProps\) \{/g,
    'export function SearchList({ title, items, headerButtons, initialSearchQuery = "", hideHeader = false, isModal = false, onDrinkPress, onBackPress }: SearchListProps) {'
);

const oldFilteringBlock = `    const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
    const [selectedCategory, setSelectedCategory] = useState<"All" | "Cocktails" | "Beers" | "Wines">("All");
    const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
    const [showFavesOnly, setShowFavesOnly] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const { toggleFavorite, isFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    // Filter and Sort
    const filteredDrinks = useMemo(() => {
        let result = items;

        if (selectedCategory !== "All") {
            const mappedCategory = selectedCategory === "Cocktails" ? "Cocktail" : selectedCategory === "Beers" ? "Beer" : "Wine";
            result = result.filter(d => d.category === mappedCategory);
        }`;

const newFilteringBlock = `    const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
    const allCategories = ["Cocktails", "Beers", "Wines", "Ingredients"];
    const [activeFilters, setActiveFilters] = useState<string[]>(allCategories);
    const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
    const [showFavesOnly, setShowFavesOnly] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const { toggleFavorite, isFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    const handleToggleFilter = useCallback((category: string) => {
        if (category === "All") {
            setActiveFilters(prev => {
                const isAllSelected = allCategories.every(cat => prev.includes(cat));
                if (isAllSelected) {
                    return [];
                } else {
                    return [...allCategories];
                }
            });
        } else {
            setActiveFilters(prev => {
                if (prev.includes(category)) {
                    return prev.filter(c => c !== category);
                } else {
                    return [...prev, category];
                }
            });
        }
    }, [allCategories]);

    // Filter and Sort
    const filteredDrinks = useMemo(() => {
        let result = items;

        if (activeFilters.length !== allCategories.length) {
            const mappedFilters = activeFilters.map(f => {
                 if (f === "Cocktails") return "Cocktail";
                 if (f === "Beers") return "Beer";
                 if (f === "Wines") return "Wine";
                 if (f === "Ingredients") return "Ingredient";
                 return f;
            });
            result = result.filter(d => d.category && mappedFilters.includes(d.category));
        }`;

content = content.replace(oldFilteringBlock, newFilteringBlock);

// Replace FilterModal call
const oldFilterModalCall = `<FilterModal 
                visible={isFilterModalVisible}
                onClose={() => setIsFilterModalVisible(false)}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                showFavesOnly={showFavesOnly}
                onToggleFavesOnly={() => setShowFavesOnly(prev => !prev)}
            />`;

const newFilterModalCall = `<FilterModal 
                visible={isFilterModalVisible}
                onClose={() => setIsFilterModalVisible(false)}
                activeFilters={activeFilters}
                onToggleFilter={handleToggleFilter}
                showFavesOnly={showFavesOnly}
                onToggleFavesOnly={() => setShowFavesOnly(prev => !prev)}
            />`;

content = content.replace(oldFilterModalCall, newFilterModalCall);

// Minor naming adjustments just to avoid confusion later:
content = content.replace(/drinks\=\{drinks\}/g, 'items={items}'); // actually the prop is items now

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Update complete.');
