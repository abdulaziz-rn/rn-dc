import * as React from 'react';
import { DynamicComponentContextConfig } from '../@types';
import { DynamicComponentProps } from '../components/DynamicComponent';
export default function createDynamicComponent({ buildRequestForUri, global, verify, }: DynamicComponentContextConfig): Readonly<{
    DynamicComponent: (props: DynamicComponentProps) => React.JSX.Element;
    preload: (uri: string) => Promise<void>;
}>;
