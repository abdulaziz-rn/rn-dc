import { AxiosPromise, AxiosRequestConfig, AxiosResponse } from 'axios';

export type PromiseCallback<T> = {
  readonly resolve: (result: T) => void;
  readonly reject: (error: Error) => void;
};

export type DynamicComponentSource = {
  readonly uri: string;
} | string;

export type DynamicComponentCache = {
  readonly [uri: string]: React.Component | null;
};

export type DynamicComponentTasks = {
  readonly [uri: string]: PromiseCallback<React.Component>[];
};

export type DynamicComponentOptions = {
  readonly dangerouslySetInnerJSX: boolean;
};

export type DynamicComponentContextConfig = {
  readonly verify: (response: AxiosResponse<string>) => Promise<boolean>;
  readonly buildRequestForUri?: (config: AxiosRequestConfig) => AxiosPromise<string>;
  readonly global?: any;
};
