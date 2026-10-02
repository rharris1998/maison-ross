import {useRef} from 'react';
import {UNSAFE_PortalProvider} from 'react-aria/PortalProvider';

// Keep nested overlays inside their parent dialog. A sibling portal can become
// inert while React Aria's parent-modal observer sees its newly mounted wrapper.
export function OverlayBoundary({children}) {
  const portal = useRef(null);
  return <UNSAFE_PortalProvider getContainer={() => portal.current}>
    {children}<div className="maison-nested-overlays" ref={portal} />
  </UNSAFE_PortalProvider>;
}
