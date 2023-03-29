/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/latest/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import "./index.css";

// eslint-disable-next-line import/no-unresolved
// import ic from "my-addon/build/Release/addon.node";

// (globalThis as any)._ic = ic;

const infoDiv = document.createElement("div");
const button = document.createElement("button");
// 点击 button 时，调用ic.IC_GetDeviceCount 方法并把结果展示到 infoDiv 中
button.addEventListener("click", () => {
  infoDiv.innerText = ic.IC_GetDeviceCount();
});
document.body.appendChild(infoDiv);
document.body.appendChild(button);

console.log(
  '👋 This message is being logged by "renderer.js", included via webpack'
);
