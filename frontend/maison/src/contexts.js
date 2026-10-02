// The contexts Maison's pages, sheets and controls share (#27, #29), in a
// module of their own so the controls in ui/ read them without importing a
// page.
import {createContext, useContext} from 'react';

// How a press reaches the element: the dashboard provides `intent =>
// element.command(intent)`, the gallery a function that does nothing.
export const CommandContext = createContext(null);
export const useCommand = () => useContext(CommandContext);
// Where a sheet is drawn: the dashboard's portal inside its shadow root.
export const PortalContext = createContext(null);
