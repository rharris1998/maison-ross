// React Aria's pinned runtime opts into composed event targets and focus walks.
// HA hosts every custom card inside a shadow root. Keep this adapter and the
// React Stately version pinned together; verify pointer + keyboard on upgrades.
import {enableShadowDOM} from 'react-stately/private/flags/flags';
enableShadowDOM();
