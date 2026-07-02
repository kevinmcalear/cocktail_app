export interface EditorChromeState {
    save: () => Promise<void>;
    cancel: () => void;
    saving: boolean;
    isDirty: boolean;
}
