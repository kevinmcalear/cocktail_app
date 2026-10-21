import { useLocalSearchParams, useRouter } from "expo-router";

import { AddIngredientRoute } from "@/components/screens/addIngredient/AddIngredientRoute";
import { CouldNotLoad } from "@/components/screens/safety/NotAvailable";
import { IngredientEditPage, useLeaveGuard } from "@/components/screens/ingredient/IngredientEditPage";
import { useIngredientDraftEditor } from "@/hooks/useIngredientEditor";
import { confirmAsync } from "@/lib/dialogs";
import { toastDone } from "@/lib/toast";

/** A new ingredient is added with the wizard; a draft saved by the older editor (New > Drafts) opens on the ingredient edit page. */
export default function AddIngredientScreen() {
    const { draftId } = useLocalSearchParams<{ draftId?: string }>();
    return draftId ? <IngredientDraft draftId={draftId} /> : <AddIngredientRoute />;
}

/** Save keeps it a draft; Publish ingredient makes it one, and hands it back to whoever asked for it (`attachTo`). */
function IngredientDraft({ draftId }: { draftId: string }) {
    const router = useRouter();
    const { barId, name, attachTo } = useLocalSearchParams<{ barId?: string; name?: string; attachTo?: string }>();
    const editor = useIngredientDraftEditor({ draftId, barId, initialName: name, attachTo: attachTo || null });
    const allowExit = useLeaveGuard(editor.isDirty);
    const close = () => (router.canGoBack() ? router.back() : router.replace("/drafts"));

    const publish = async () => {
        if (!(await confirmAsync({ title: "Publish ingredient", message: "Are you sure you want to publish this ingredient?", confirmText: "Publish" }))) return;
        const id = await editor.publish();
        if (!id) return;
        toastDone("Ingredient saved", editor.form.name.trim());
        allowExit();
        close();
    };

    if (editor.loading) return editor.draftsFailed ? <CouldNotLoad what="draft" failed={editor.draftsFailed} /> : null;
    return <IngredientEditPage editor={editor} eyebrow="DRAFT" onBack={close} onSave={() => void editor.saveAsDraft()} saveLabel="Save draft" onPublish={() => void publish()} />;
}
