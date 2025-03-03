import * as React from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { DynamicComponentOptions, DynamicComponentSource } from '../@types';
import { useForceUpdate } from '../hooks';

export type DynamicComponentProps = {
  readonly source: DynamicComponentSource;
  readonly renderLoading?: () => JSX.Element;
  readonly renderError?: (props: { readonly error: Error }) => JSX.Element;
  readonly dangerouslySetInnerJSX?: boolean;
  readonly onError?: (error: Error) => void;
  readonly shouldOpenWormhole?: (
    source: DynamicComponentSource,
    options: DynamicComponentOptions
  ) => Promise<React.Component>;
};

export default function DynamicComponent({
  source,
  renderLoading = () => <React.Fragment />,
  renderError = () => <React.Fragment />,
  dangerouslySetInnerJSX = false,
  onError = console.error,
  shouldOpenWormhole,
  ...extras
}: DynamicComponentProps): JSX.Element {
  const { forceUpdate } = useForceUpdate();
  const [Component, setComponent] = React.useState<React.Component | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  React.useEffect(() => {
    (async () => {
      try {
        if (typeof shouldOpenWormhole === 'function') {
          const Component = await shouldOpenWormhole(source, { dangerouslySetInnerJSX });
          return setComponent(() => Component);
        }
        throw new Error(
          `[DynamicComponent]: Expected function shouldOpenWormhole, encountered ${
            typeof shouldOpenWormhole
          }.`
        );
      } catch (e : any) {
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
  const FallbackComponent = React.useCallback((): JSX.Element => {
    return renderError({ error: new Error('[DynamicComponent]: Failed to render.') });
  }, [renderError]);
  if (typeof Component === 'function') {
    return (
      <ErrorBoundary FallbackComponent={FallbackComponent}>
        {/* @ts-ignore */}
        <Component {...extras} />
      </ErrorBoundary>
    );
  } else if (error) {
    return renderError({ error });
  }
  return renderLoading();
}
