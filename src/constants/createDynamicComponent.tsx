import * as React from 'react';
import axios, { AxiosPromise, AxiosRequestConfig, AxiosResponse } from 'axios';

import {
  PromiseCallback,
  DynamicComponentContextConfig,
  DynamicComponentSource,
  DynamicComponentOptions,
  DynamicComponentCache,
  DynamicComponentTasks,
} from '../@types';

import { DynamicComponent as BaseWormhole } from '../components';
import { DynamicComponentProps } from '../components/DynamicComponent';

const globalName = '__DYNAMICCOMPONENT__';

const defaultGlobal = Object.freeze({
  require: (moduleId: string) => {
    if (moduleId === 'react') {
      // @ts-ignore
      return require('react');
    } else if (moduleId === 'react-native') {
      // @ts-ignore
      return require('react-native');
    }
    return null;
  },
});

const buildCompletionHandler = (
  cache: DynamicComponentCache,
  tasks: DynamicComponentTasks,
) => (uri: string, error?: Error): void => {
  const { [uri]: maybeComponent } = cache;
  const { [uri]: callbacks } = tasks;
  Object.assign(tasks, { [uri]: null });
  callbacks.forEach(({ resolve, reject }) => {
    if (!!maybeComponent) {
      return resolve(maybeComponent);
    }
    return reject(
      error || new Error(`[DynamicComponent]: Failed to allocate for uri "${uri}".`)
    );
  });
};

const buildCreateComponent = (
  global: any
) => async (src: string): Promise<React.Component> => {
  const Component = await new Function(
    globalName,
    `${Object.keys(global).map((key) => `var ${key} = ${globalName}.${key};`).join('\n')}; const exports = {}; ${src}; return exports.default;`
  )(global);
  if (typeof Component !== 'function') {
    throw new Error(
      `[DynamicComponent]: Expected function, encountered ${typeof Component}. Did you forget to mark your Wormhole as a default export?`
    );
  }
  return Component;
};

const buildRequestOpenUri = ({
  cache,
  buildRequestForUri,
  verify,
  shouldCreateComponent,
  shouldComplete,
}: {
  readonly cache: DynamicComponentCache,
  readonly buildRequestForUri: (config: AxiosRequestConfig) => AxiosPromise<string>;
  readonly verify: (response: AxiosResponse<string>) => Promise<boolean>;
  readonly shouldCreateComponent: (src: string) => Promise<React.Component>;
  readonly shouldComplete: (uri: string, error?: Error) => void;
}) => async (uri: string) => {
  try {
    const result = await buildRequestForUri({
      url: uri,
      method: 'get',
    });
    const { data } = result;
    if (typeof data !== 'string') {
      throw new Error(`[DynamicComponent]: Expected string data, encountered ${typeof data}.`);
    }
    if (await verify(result) !== true) {
      throw new Error(`[DynamicComponent]: Failed to verify "${uri}".`);
    }
    const Component = await shouldCreateComponent(data);
    Object.assign(cache, { [uri]: Component });
    return shouldComplete(uri);
  } catch (e : any) {
    Object.assign(cache, { [uri]: null });
    if (typeof e === 'string') {
      return shouldComplete(uri, new Error(e));
    } else if (typeof e.message === 'string') {
      return shouldComplete(uri, new Error(`${e.message}`));
    }
    return shouldComplete(uri, e);
  }
};

const buildOpenUri = ({
  cache,
  tasks,
  shouldRequestOpenUri,
}: {
  readonly cache: DynamicComponentCache;
  readonly tasks: DynamicComponentTasks;
  readonly shouldRequestOpenUri: (uri: string) => void;
}) => (uri: string, callback: PromiseCallback<React.Component>): void => {
  const { [uri]: Component } = cache;
  const { resolve, reject } = callback;
  if (Component === null) {
    return reject(
      new Error(`[DynamicComponent]: Component at uri "${uri}" could not be instantiated.`)
    );
  } else if (typeof Component === 'function') {
    return resolve(Component);
  }

  const { [uri]: queue } = tasks;
  if (Array.isArray(queue)) {
    queue.push(callback);
    return;
  }

  Object.assign(tasks, { [uri]: [callback] });

  return shouldRequestOpenUri(uri);
};

const buildOpenString = ({
  shouldCreateComponent,
}: {
  readonly shouldCreateComponent: (src: string) => Promise<React.Component>;
}) => async (src: string) => {
  return shouldCreateComponent(src);
};

const buildOpenWormhole = ({
  shouldOpenString,
  shouldOpenUri,
}: {
  readonly shouldOpenString: (src: string) => Promise<React.Component>;
  readonly shouldOpenUri: (
    uri: string,
    callback: PromiseCallback<React.Component>
  ) => void;
}) => async (source: DynamicComponentSource, options: DynamicComponentOptions): Promise<React.Component> => {
  const { dangerouslySetInnerJSX } = options;
  if (typeof source === 'string') {
    if (dangerouslySetInnerJSX === true) {
      return shouldOpenString(source as string);
    }
    throw new Error(
      `[DynamicComponent]: Attempted to instantiate a Wormhole using a string, but dangerouslySetInnerJSX was not true.`
    );
  } else if (source && typeof source === 'object') {
    const { uri } = source;
    if (typeof uri === 'string') {
      return new Promise<React.Component>(
        (resolve, reject) => shouldOpenUri(uri, { resolve, reject }),
      );
    }
  }
  throw new Error(`[DynamicComponent]: Expected valid source, encountered ${typeof source}.`);
};

export default function createDynamicComponent({
  buildRequestForUri = (config: AxiosRequestConfig) => axios(config),
  global = defaultGlobal,
  verify,
}: DynamicComponentContextConfig) {
  if (typeof verify !== 'function') {
    throw new Error(
      '[DynamicComponent]: To create a DynamicComponent, you **must** pass a verify() function.',
    );
  }

  const cache: DynamicComponentCache = {};
  const tasks: DynamicComponentTasks = {};

  const shouldComplete = buildCompletionHandler(cache, tasks);
  const shouldCreateComponent = buildCreateComponent(global);
  const shouldRequestOpenUri = buildRequestOpenUri({
    cache,
    buildRequestForUri,
    verify,
    shouldCreateComponent,
    shouldComplete,
  });
  const shouldOpenUri = buildOpenUri({
    cache,
    tasks,
    shouldRequestOpenUri,
  });
  const shouldOpenString = buildOpenString({
    shouldCreateComponent,
  });

  const shouldOpenWormhole = buildOpenWormhole({
    shouldOpenUri,
    shouldOpenString,
  });

  const DynamicComponent = (props: DynamicComponentProps) => (
    <BaseWormhole {...props} shouldOpenWormhole={shouldOpenWormhole} />
  );

  const preload = async (uri: string): Promise<void> => {
    await shouldOpenWormhole({ uri }, { dangerouslySetInnerJSX: false })
  };

  return Object.freeze({
    DynamicComponent,
    preload,
  });
}
