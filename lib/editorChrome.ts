export interface EditorChromeState {
    save: () => Promise<void>;
    cancel: () => void;
    /** When set, workspace shows Delete / Save Draft / Publish (Cancel/back still shown) */
    publish?: () => Promise<void>;
    discard?: () => void;
    saving: boolean;
    isDirty: boolean;
    canPublish?: boolean;
}
