import { getPreferenceValues, showToast, Toast } from "@raycast/api";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// 2D 网格表示法：数字 = 窗口序号 (1-based)，0 = 空位，相同数字代表跨格
type LayoutGrid = number[][];

const MAX_WINDOWS = 10;

function layoutFor(count: number): LayoutGrid {
  switch (count) {
    case 1:
      return [[1]];
    case 2:
      return [[1, 2]];
    case 3:
      return [
        [1, 3],
        [2, 3],
      ];
    case 4:
      return [
        [1, 2],
        [3, 4],
      ];
    case 5:
      return [
        [1, 2, 5],
        [3, 4, 5],
      ];
    case 6:
      return [
        [1, 2, 3],
        [4, 5, 6],
      ];
    case 7:
      return [
        [1, 2, 3, 4],
        [5, 6, 7, 0],
      ];
    case 8:
      return [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ];
    case 9:
      return [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];
    default:
      return [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
      ];
  }
}

interface Frame {
  windowIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function computeFrames(
  grid: LayoutGrid,
  screen: { width: number; height: number },
  gap: number,
): Frame[] {
  const rows = grid.length;
  const cols = grid[0].length;
  const cellW = (screen.width - gap * (cols + 1)) / cols;
  const cellH = (screen.height - gap * (rows + 1)) / rows;

  const extents: Record<
    number,
    { minC: number; maxC: number; minR: number; maxR: number }
  > = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const n = grid[r][c];
      if (n === 0) continue;
      const e = extents[n];
      if (!e) {
        extents[n] = { minC: c, maxC: c, minR: r, maxR: r };
      } else {
        if (c < e.minC) e.minC = c;
        if (c > e.maxC) e.maxC = c;
        if (r < e.minR) e.minR = r;
        if (r > e.maxR) e.maxR = r;
      }
    }
  }

  return Object.entries(extents).map(([n, e]) => {
    const colSpan = e.maxC - e.minC + 1;
    const rowSpan = e.maxR - e.minR + 1;
    return {
      windowIndex: Number(n) - 1,
      x: Math.round(gap + e.minC * (cellW + gap)),
      y: Math.round(gap + e.minR * (cellH + gap)),
      width: Math.round(colSpan * cellW + (colSpan - 1) * gap),
      height: Math.round(rowSpan * cellH + (rowSpan - 1) * gap),
    };
  });
}

// 转义 AppleScript 字符串字面量中的反斜杠和双引号
function escAS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function osa(script: string): Promise<string> {
  const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", script]);
  return stdout.trim();
}

async function jxa(script: string): Promise<string> {
  const { stdout } = await execFileAsync("/usr/bin/osascript", [
    "-l",
    "JavaScript",
    "-e",
    script,
  ]);
  return stdout.trim();
}

async function getFrontmostAppName(): Promise<string | null> {
  try {
    const out = await osa(
      'tell application "System Events" to get name of first application process whose frontmost is true',
    );
    return out || null;
  } catch {
    return null;
  }
}

// 统计指定 app 当前非最小化的窗口数；进程不存在或全部最小化返回 0
async function countVisibleWindows(appName: string): Promise<number> {
  const script = `
tell application "System Events"
  if not (exists application process "${escAS(appName)}") then return "0"
  tell application process "${escAS(appName)}"
    set c to 0
    repeat with w in windows
      try
        if (value of attribute "AXMinimized" of w) is false then
          set c to c + 1
        end if
      on error
        set c to c + 1
      end try
    end repeat
    return (c as string)
  end tell
end tell`;
  try {
    const out = await osa(script);
    return Number.parseInt(out, 10) || 0;
  } catch {
    return 0;
  }
}

// 屏幕可用区（已去掉菜单栏和 Dock），坐标转成 AX 系（左上为原点，Y 向下）
// 选鼠标当前所在的那块屏；找不到就回退到 mainScreen
async function getScreenVisibleFrameAX(): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const script = `
ObjC.import('AppKit');
var mouseLoc = $.NSEvent.mouseLocation;
var screens = $.NSScreen.screens;
var n = screens.count;
var target;
for (var i = 0; i < n; i++) {
  var s = screens.objectAtIndex(i);
  var f = s.frame;
  if (mouseLoc.x >= f.origin.x && mouseLoc.x < f.origin.x + f.size.width &&
      mouseLoc.y >= f.origin.y && mouseLoc.y < f.origin.y + f.size.height) {
    target = s;
    break;
  }
}
if (!target) target = $.NSScreen.mainScreen;

// AX 坐标原点是主屏（screens[0]）左上角；Cocoa 是主屏左下角，Y 向上
var primaryHeight = screens.objectAtIndex(0).frame.size.height;
var vis = target.visibleFrame;
JSON.stringify({
  x: vis.origin.x,
  y: primaryHeight - (vis.origin.y + vis.size.height),
  width: vis.size.width,
  height: vis.size.height
});`;
  const out = await jxa(script);
  return JSON.parse(out);
}

// 把所有目标 frame 在一次 osascript 调用里批量写入，减少 spawn 开销
async function applyFramesViaOSA(
  appName: string,
  frames: Frame[],
): Promise<void> {
  if (frames.length === 0) return;
  const sorted = [...frames].sort((a, b) => a.windowIndex - b.windowIndex);
  const setBlocks = sorted
    .map((f) => {
      const idx = f.windowIndex + 1;
      // 跨屏移动时 macOS 可能先把 position 钳在原屏内，所以 position 写两次：
      // 第一次让窗口跨过去，set size 后再写一次确保落点正确
      return `if (count of visibles) >= ${idx} then
      try
        set position of (item ${idx} of visibles) to {${f.x}, ${f.y}}
        set size of (item ${idx} of visibles) to {${f.width}, ${f.height}}
        set position of (item ${idx} of visibles) to {${f.x}, ${f.y}}
      end try
    end if`;
    })
    .join("\n    ");

  const script = `
tell application "System Events"
  if not (exists application process "${escAS(appName)}") then return ""
  tell application process "${escAS(appName)}"
    set visibles to {}
    repeat with w in windows
      try
        if (value of attribute "AXMinimized" of w) is false then
          set end of visibles to w
        end if
      on error
        set end of visibles to w
      end try
    end repeat
    ${setBlocks}
  end tell
end tell`;
  await osa(script);
}

export default async function Command() {
  const prefs = getPreferenceValues<Preferences.Tile>();
  const appNames = (prefs.appName || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const gap = Math.max(0, Number.parseInt(prefs.gap || "0", 10) || 0);

  const toast = await showToast({
    style: Toast.Style.Animated,
    title: "Tiling windows…",
  });

  try {
    // 1) 候选 app 名列表：偏好留空则取当前前台 app
    let filterNames = appNames;
    if (filterNames.length === 0) {
      const front = await getFrontmostAppName();
      filterNames = front ? [front] : [];
    }
    if (filterNames.length === 0) {
      toast.style = Toast.Style.Failure;
      toast.title = "No focused window to detect target app";
      return;
    }

    // 2) 按列表顺序选第一个有可见窗口的 app
    let chosenApp = "";
    let count = 0;
    for (const name of filterNames) {
      const c = await countVisibleWindows(name);
      if (c > 0) {
        chosenApp = name;
        count = Math.min(c, MAX_WINDOWS);
        break;
      }
    }
    if (count === 0) {
      toast.style = Toast.Style.Failure;
      toast.title = `No tileable windows found (looked for: ${filterNames.join(", ")})`;
      return;
    }

    // 3) 拿屏幕可用区（已扣菜单栏 / Dock）
    const visible = await getScreenVisibleFrameAX();

    // 4) 算出每个窗口在可用区内的相对位置，再平移到屏幕绝对坐标
    const grid = layoutFor(count);
    const frames = computeFrames(
      grid,
      { width: visible.width, height: visible.height },
      gap,
    )
      .filter((f) => f.windowIndex < count)
      .map((f) => ({
        ...f,
        x: f.x + visible.x,
        y: f.y + visible.y,
      }));

    // 5) 一次性写入所有窗口
    await applyFramesViaOSA(chosenApp, frames);

    toast.style = Toast.Style.Success;
    toast.title = `Tiled ${count} ${chosenApp} window${count === 1 ? "" : "s"}`;
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to tile windows";
    toast.message = error instanceof Error ? error.message : String(error);
  }
}
