# 🌌 [`sanar-dynamic-component`](#)
A `DynamicComponent` allows your [⚛️ **React Native**](https://reactnative.dev) application to consume components from a remote URL as if it were a local `import`, enabling them to easily become remotely configurable at runtime!

> ⚠️ Implementors must take care to protect their DynamicComponents from **arbitrary code execution**. Insufficient protection will put your user's data and device at risk. 💀 Please see [**Verification and Signing**](#) for more information.

### 🚀 Getting Started

Using [**Yarn**](https://yarnpkg.com):

```sh
yarn add https://github.com/MarenTech/sanar-dynamic-component.git
```

Next, you'll need a component to serve. Let's create a quick project to demonstrate how this works:

```
mkdir my-new-dynamic-component
cd my-new-dynamic-component
yarn init
yarn add --dev @babel/core @babel/cli @babel/preset-env @babel/preset-react
```

That should be enough. Inside `my-new-dynamic-component/`, let's quickly create a simple component:

**`my-new-dynamic-component/MyNewDynamicComponent.jsx`**:

```javascript
import * as React from 'react';
import { Animated, Alert, TouchableOpacity } from 'react-native';

function CustomButton() {
  return (
    <TouchableOpacity onPress={() => Alert.alert('Hello!')}>
      <Animated.Text children="Click here!" />
    </TouchableOpacity>
  );
}

export default function MyNewDynamicComponent() {
  const message = React.useMemo(() => 'Hello, world!', []);
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'red' }}>
      <Animated.Text>{message}</Animated.Text>
      <CustomButton />
    </Animated.View>
  );
}
```

> 🤔 **What syntax am I allowed to use?**
> 
> By default, you can use all functionality exported by `react` and `react-native`. The only requirement is that you must `export default` the Component that you wish to have served through the `DynamicComponent`.

Now our component needs to be [**transpiled**](https://babeljs.io/docs/en/babel-cli). Below, we use [**Babel**](https://babeljs.io/) to convert `MyNewDynamicComponent` into a format that can be executed at runtime:

> To Transpile JS Components
```
npx babel --presets=@babel/preset-env,@babel/preset-react MyNewDynamicComponent.jsx -o MyNewDynamicComponent.js
```

> To Transpile TSX Components
```
npx babel --presets=@babel/preset-env,@babel/preset-react,@babel/preset-typescript MyNewDynamicComponent.tsx -o MyNewDynamicComponent.js
```

After doing this, we'll have produced `MyNewDynamicComponent.js`, which has been expressed in a format that is suitable to serve remotely. If you're unfamiliar with this process, take a quick look through the contents of the generated file to understand how it has changed.

Next, you'd need to serve this file somewhere. For example, you could save it on GitHub, [**IPFS**](https://ipfs.io/) or on your own local server. To see an example of this, check out the [**Example Server**](./example/scripts/serve.js).

> 👮 **Security Notice**
> 
> In production environments, you **must** serve content using [**HTTPS**](https://en.wikipedia.org/wiki/HTTPS) to prevent [**Man in the Middle**](https://en.wikipedia.org/wiki/Man-in-the-middle_attack) attacks. Additionally, served content must be signed using public-key encryption to ensure authenticity of the returned source code. A demonstration of this approach using [**Ethers**](https://github.com/ethers-io/ethers.js/) is shown in the [**Example App**](#).


Finally, let's render our `<App />`! For the purpose of this tutorial, let's assume the file is served at [#](#):

```javascript
import * as React from 'react';
import { createDynamicComponent } from 'sanar-dynamic-component';

const { DynamicComponent } = createDynamicComponent({
  verify: async () => true,
});

export default function App() {
  return <DynamicComponent source={{ uri: 'https://localhost/MyNewDynamicComponent.jsx' }} />;
}
```

And that's everything! Once our component has finished downloading, it'll be mounted and visible on screen. 🚀

### 🔩 Configuration

#### 🌎 Global Scope

By default, a `DynamicComponent` is only capable of consuming global functionality from two different modules; [`react`](https://github.com/facebook/react) and [`react-native`](https://github.com/facebook/react-native), meaning that only "vanilla" React Native functionality is available. However, it is possible to introduce support for additional modules. In the snippet below, we show how to allow a `DynamicComponent` to render a [`WebView`](https://github.com/react-native-webview/react-native-webview):

```diff
const { DynamicComponent } = createDynamicComponent({
+  global: {
+    require: (moduleId: string) => {
+      if (moduleId === 'react') {
+        return require('react');
+      } else if (moduleId === 'react-native') {
+        return require('react-native');
+      } else if (moduleId === 'react-native-webview') {
+        return require('react-native-webview);
+      }
+      return null;
+    },
+  },
  verify: async () => true,
});
```

> ⚠️  Version changes to `react`, `react-native` or any other dependencies your DynamicComponents consume may not be backwards-compatible. It's recommended that APIs serving content to requestors verify the compatibility of the requester version to avoid serving incompatible content. `sanar-dynamic-component` is **not** a package manager!

#### 🔏 Verification and Signing

Calls to [`createDynamicComponent`](#) must at a minimum provide a `verify` function, which has the following declaration:

```typescript
readonly verify: (response: AxiosResponse<string>) => Promise<boolean>;
```

This property is used to determine the integrity of a response, and is responsible for identifying whether remote content may be trusted for execution. If the `async` function does not return `true`, the request is terminated and the content will not be rendered via a `DynamicComponent`. In the [**Example App**](#), we show how content can be signed to determine the authenticity of a response:

```diff
+ import { ethers } from 'ethers';
+ import { SIGNER_ADDRESS, PORT } from '@env';

const { DynamicComponent } = createDynamicComponent({
+  verify: async ({ headers, data }: AxiosResponse) => {
+    const signature = headers['x-csrf-token'];
+    const bytes = ethers.utils.arrayify(signature);
+    const hash = ethers.utils.hashMessage(data);
+    const address = await ethers.utils.recoverAddress(
+      hash,
+      bytes
+    );
+    return address === SIGNER_ADDRESS;
+  },
});
```

In this implementation, the server is expected to return a HTTP response header `x-csrf-token` whose value is a [`signedMessage`](https://docs.ethers.io/v5/api/signer/) of the response body. Here, the client computes the expected signing address of the served content using the digest stored in the header.

If the recovered address is not trusted, the script **will not be executed**.

#### 🏎️  Preloading

Making a call to `createDynamicComponent()` also returns a `preload` function which can be used to asynchronously cache remote JSX before a `DynamicComponent` has been mounted:

```typescript
const { preload } = createDynamicComponent({ verify: async () => true });

(async () => {
  try {
    await preload('#');
  } catch (e) {
    console.error('Failed to preload.');
  }
})();
```

DynamicComponent dependent upon the external content will subsequently render immediately if the operation has completed in time. Meanwhile, concurrent requests to the same resource will be deduped.

### ✌️ License
[**MIT**](./LICENSE)
