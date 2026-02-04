import { CocktailList } from "@/components/CocktailList";
import { Stack } from "expo-router";

export default function Top20Screen() {
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <CocktailList
                title="Top 20"
                cocktails={[]}
            />
        </>
    );
}
