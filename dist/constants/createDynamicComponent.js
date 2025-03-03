import * as React from 'react';
import axios from 'axios';
import { DynamicComponent as BaseWormhole } from '../components';
const globalName = '__DYNAMICCOMPONENT__';
const defaultGlobal = Object.freeze({
    require: (moduleId) => {
        if (moduleId === 'react') {
            return require('react');
        }
        else if (moduleId === 'react-native') {
            return require('react-native');
        }
        return null;
    },
});
const buildCompletionHandler = (cache, tasks) => (uri, error) => {
    const { [uri]: maybeComponent } = cache;
    const { [uri]: callbacks } = tasks;
    Object.assign(tasks, { [uri]: null });
    callbacks.forEach(({ resolve, reject }) => {
        if (!!maybeComponent) {
            return resolve(maybeComponent);
        }
        return reject(error || new Error(`[DynamicComponent]: Failed to allocate for uri "${uri}".`));
    });
};
const buildCreateComponent = (global) => async (src) => {
    const Component = await new Function(globalName, `${Object.keys(global).map((key) => `var ${key} = ${globalName}.${key};`).join('\n')}; const exports = {}; ${src}; return exports.default;`)(global);
    if (typeof Component !== 'function') {
        throw new Error(`[DynamicComponent]: Expected function, encountered ${typeof Component}. Did you forget to mark your Wormhole as a default export?`);
    }
    return Component;
};
const buildRequestOpenUri = ({ cache, buildRequestForUri, verify, shouldCreateComponent, shouldComplete, }) => async (uri) => {
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
    }
    catch (e) {
        Object.assign(cache, { [uri]: null });
        if (typeof e === 'string') {
            return shouldComplete(uri, new Error(e));
        }
        else if (typeof e.message === 'string') {
            return shouldComplete(uri, new Error(`${e.message}`));
        }
        return shouldComplete(uri, e);
    }
};
const buildOpenUri = ({ cache, tasks, shouldRequestOpenUri, }) => (uri, callback) => {
    const { [uri]: Component } = cache;
    const { resolve, reject } = callback;
    if (Component === null) {
        return reject(new Error(`[DynamicComponent]: Component at uri "${uri}" could not be instantiated.`));
    }
    else if (typeof Component === 'function') {
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
const buildOpenString = ({ shouldCreateComponent, }) => async (src) => {
    return shouldCreateComponent(src);
};
const buildOpenWormhole = ({ shouldOpenString, shouldOpenUri, }) => async (source, options) => {
    const { dangerouslySetInnerJSX } = options;
    if (typeof source === 'string') {
        if (dangerouslySetInnerJSX === true) {
            return shouldOpenString(source);
        }
        throw new Error(`[DynamicComponent]: Attempted to instantiate a Wormhole using a string, but dangerouslySetInnerJSX was not true.`);
    }
    else if (source && typeof source === 'object') {
        const { uri } = source;
        if (typeof uri === 'string') {
            return new Promise((resolve, reject) => shouldOpenUri(uri, { resolve, reject }));
        }
    }
    throw new Error(`[DynamicComponent]: Expected valid source, encountered ${typeof source}.`);
};
export default function createDynamicComponent({ buildRequestForUri = (config) => axios(config), global = defaultGlobal, verify, }) {
    if (typeof verify !== 'function') {
        throw new Error('[DynamicComponent]: To create a DynamicComponent, you **must** pass a verify() function.');
    }
    const cache = {};
    const tasks = {};
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
    const DynamicComponent = (props) => (React.createElement(BaseWormhole, { ...props, shouldOpenWormhole: shouldOpenWormhole }));
    const preload = async (uri) => {
        await shouldOpenWormhole({ uri }, { dangerouslySetInnerJSX: false });
    };
    return Object.freeze({
        DynamicComponent,
        preload,
    });
}
