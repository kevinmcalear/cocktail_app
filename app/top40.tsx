import { CocktailList } from "@/components/CocktailList";
import { Stack } from "expo-router";

export default function Top40Screen() {
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <CocktailList
                title="Top 40"
                cocktails={[]}
            />
        </>
    );
}
