import { DrinkList } from "@/components/DrinkList";
import { Stack } from "expo-router";

export default function Top40Screen() {
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <DrinkList
                title="Top 40"
                drinks={[]}
            />
        </>
    );
}
