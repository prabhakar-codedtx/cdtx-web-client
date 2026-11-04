import { createContext } from 'react';

/**
 * Set by the details dialog: the height of the room it gives a screen. A screen drawn inside it uses this
 * where it would use the window's height (a hero that fills the screen) and does not force a full-window
 * page height. Null outside a dialog.
 */
export const DialogRoomContext = createContext<{ height: number } | null>(null);
