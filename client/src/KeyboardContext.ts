import { createContext } from "react";

export const KeyboardContext = createContext<{
    shown: boolean;
    setShown: (shown: boolean) => void;
    show: (inputElement: HTMLInputElement | HTMLTextAreaElement, onChange: (newValue: string) => void, hideKeyboardOnEnter?: boolean) => void;
    setValue: (value: string) => void;
    hide: () => void;
}>({} as any);
