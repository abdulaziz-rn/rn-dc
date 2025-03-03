import * as React from 'react';
export default function useForceUpdate() {
    const [, setState] = React.useState(false);
    const forceUpdate = React.useCallback(() => {
        setState(e => !e);
    }, [setState]);
    return { forceUpdate };
}
