import * as React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useForceUpdate } from '../hooks';
export default function DynamicComponent({ source, renderLoading = () => React.createElement(React.Fragment, null), renderError = () => React.createElement(React.Fragment, null), dangerouslySetInnerJSX = false, onError = console.error, shouldOpenWormhole, ...extras }) {
    const { forceUpdate } = useForceUpdate();
    const [Component, setComponent] = React.useState(null);
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
        (async () => {
            try {
                if (typeof shouldOpenWormhole === 'function') {
                    const Component = await shouldOpenWormhole(source, { dangerouslySetInnerJSX });
                    return setComponent(() => Component);
                }
                throw new Error(`[DynamicComponent]: Expected function shouldOpenWormhole, encountered ${typeof shouldOpenWormhole}.`);
            }
            catch (e) {
                setComponent(() => null);
                setError(e);
                onError(e);
                return forceUpdate();
            }
        })();
    }, [
        shouldOpenWormhole,
        source,
        setComponent,
        forceUpdate,
        setError,
        dangerouslySetInnerJSX,
        onError,
    ]);
    const FallbackComponent = React.useCallback(() => {
        return renderError({ error: new Error('[DynamicComponent]: Failed to render.') });
    }, [renderError]);
    if (typeof Component === 'function') {
        return (React.createElement(ErrorBoundary, { FallbackComponent: FallbackComponent },
            React.createElement(Component, { ...extras })));
    }
    else if (error) {
        return renderError({ error });
    }
    return renderLoading();
}
