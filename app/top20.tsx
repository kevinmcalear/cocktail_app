import { DrinkList } from "@/components/DrinkList";
import { Stack } from "expo-router";

export default function Top20Screen() {
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <DrinkList
                title="Top 20"
                drinks={[]}
            />
        </>
    );
}
