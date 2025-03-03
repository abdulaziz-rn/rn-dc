import * as React from 'react';
import { DynamicComponentOptions, DynamicComponentSource } from '../@types';
export type DynamicComponentProps = {
    readonly source: DynamicComponentSource;
    readonly renderLoading?: () => JSX.Element;
    readonly renderError?: (props: {
        readonly error: Error;
    }) => JSX.Element;
    readonly dangerouslySetInnerJSX?: boolean;
    readonly onError?: (error: Error) => void;
    readonly shouldOpenWormhole?: (source: DynamicComponentSource, options: DynamicComponentOptions) => Promise<React.Component>;
};
export default function DynamicComponent({ source, renderLoading, renderError, dangerouslySetInnerJSX, onError, shouldOpenWormhole, ...extras }: DynamicComponentProps): JSX.Element;
