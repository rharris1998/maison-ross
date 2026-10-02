// The dashboard bundle's entry (vendor/maison-react.js): Maison (#29), its
// pages (pages.jsx) in the frame, the page's drawer and the dialog in
// Maison's Sheet, and (v35) Maison's own toasts, all from one screen value.
// The providers let a page press, portal and attach Home Assistant's cards.
// It loads the shadow-DOM adapter first.
import './shadow-dom.js';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {UNSAFE_PortalProvider} from 'react-aria/PortalProvider';
import {CommandContext, PortalContext} from './contexts.js';
import {NativeContext} from './native.jsx';
import {appStyles} from './app.css.js';
import {ToastRegion, createToastQueue} from './ui/toast.jsx';
import {Frame} from './frame.jsx';
import {PAGES} from './pages.jsx';
import {DialogSheet, DrawerSheet} from './sheets.jsx';

// The whole dashboard from one screen value: {chrome, page, drawer, dialog},
// and the toasts from `queue` (mountDashboard's createToastQueue()), which
// the frame lifts above the phone tab bar (.m-toasts).
function App({screen: {chrome, page, drawer, dialog}, command, attachNative, portal, queue}) {
  const Page = PAGES[page.id];
  return <UNSAFE_PortalProvider getContainer={() => portal}><PortalContext.Provider value={portal}><CommandContext.Provider value={command}><NativeContext.Provider value={attachNative}>
    <style>{appStyles}</style>
    <Frame chrome={chrome}><main className="m-page" key={page.id}><Page value={page}/></main></Frame>
    <DrawerSheet value={drawer} isOpen={Boolean(drawer) && !dialog}/>
    <DialogSheet value={dialog}/>
    <ToastRegion queue={queue} className="m-toasts"/>
  </NativeContext.Provider></CommandContext.Provider></PortalContext.Provider></UNSAFE_PortalProvider>;
}

// The element draws right after mounting, and on every render after that:
// update(screen) with screen(snapshot). It passes its shadow root (where the
// overlay portal goes), `command(intent)` for every press and
// `attachNative(slot, key, config)` for Home Assistant's own cards. Maison's
// toasts come from its own queue (ui/toast.jsx), which toast(message)
// fills.
export function mountDashboard(host, {shadowRoot, command, attachNative}) {
  const portal = document.createElement('div'); portal.className = 'maison-overlays'; shadowRoot.append(portal);
  const queue = createToastQueue(), root = createRoot(host); let mounted = true;
  const update = screen => { if (mounted) flushSync(() => root.render(<App screen={screen} command={command} attachNative={attachNative} portal={portal} queue={queue}/>)); };
  return {update, toast(message) { queue.add({title: message}, {timeout: 5500}); },
    unmount() { mounted = false; root.unmount(); queue.clear(); portal.remove(); }};
}
