/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `tile` command */
  export type Tile = ExtensionPreferences & {
  /** 目标应用名（逗号分隔） - 例：Ghostty, Terminal, iTerm2。留空 = 自动识别当前活跃窗口所属 app */
  "appName": string,
  /** 窗口间距 (px) - 窗口之间和屏幕边缘的间距，0 表示无缝紧贴 */
  "gap": string
}
}

declare namespace Arguments {
  /** Arguments passed to the `tile` command */
  export type Tile = {}
}

