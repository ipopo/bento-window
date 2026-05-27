import { getPreferenceValues, showToast, Toast } from "@raycast/api";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
        [5, 6, 7, 7],
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

function computeFrames(grid: LayoutGrid, screen: { width: number; height: number }, gap: number): Frame[] {
  const rows = grid.length;
  const cols = grid[0].length;
  const cellW = (screen.width - gap * (cols + 1)) / cols;
  const cellH = (screen.height - gap * (rows + 1)) / rows;

  const extents: Record<number, { minC: number; maxC: number; minR: number; maxR: number }> = {};
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

interface ScanResult {
  chosenApp: string;
  pids: number[];
  count: number;
  screen: { x: number; y: number; width: number; height: number };
}

// 一次 JXA 调用完成所有读取：前台 app、候选 app 的 PID 和窗口数、屏幕可用区
async function scanAll(candidates: string[]): Promise<ScanResult | null> {
  const script = `
ObjC.import('AppKit');
var se = Application('System Events');
var ws = $.NSWorkspace.sharedWorkspace;

var frontApp = '';
try { frontApp = ws.frontmostApplication.localizedName.js; } catch(e) {}

var candidates = ${JSON.stringify(candidates)};
if (candidates.length === 0 && frontApp) candidates = [frontApp];

var chosen = null;
var allApps = ws.runningApplications;
for (var ci = 0; ci < candidates.length; ci++) {
  var target = candidates[ci].toLowerCase();
  var pids = [];
  for (var i = 0; i < allApps.count; i++) {
    var a = allApps.objectAtIndex(i);
    var n = a.localizedName ? a.localizedName.js : '';
    if (n.toLowerCase() === target) pids.push(a.processIdentifier);
  }
  if (pids.length === 0) continue;
  var vc = 0;
  for (var pi = 0; pi < pids.length; pi++) {
    try {
      var proc = se.applicationProcesses.whose({unixId: pids[pi]})[0];
      var wins = proc.windows();
      for (var j = 0; j < wins.length; j++) {
        try { if (!wins[j].attributes.byName('AXMinimized').value()) vc++; }
        catch(e) { vc++; }
      }
    } catch(e) {}
  }
  if (vc > 0) {
    chosen = {name: candidates[ci], pids: pids, count: Math.min(vc, ${MAX_WINDOWS})};
    break;
  }
}

if (!chosen) { JSON.stringify(null); } else {
  var mouseLoc = $.NSEvent.mouseLocation;
  var screens = $.NSScreen.screens;
  var tgt;
  for (var si = 0; si < screens.count; si++) {
    var s = screens.objectAtIndex(si);
    var f = s.frame;
    if (mouseLoc.x >= f.origin.x && mouseLoc.x < f.origin.x + f.size.width &&
        mouseLoc.y >= f.origin.y && mouseLoc.y < f.origin.y + f.size.height) {
      tgt = s; break;
    }
  }
  if (!tgt) tgt = $.NSScreen.mainScreen;

  var ps = screens.objectAtIndex(0);
  var pH = ps.frame.size.height;
  var vis = tgt.visibleFrame;
  var frm = tgt.frame;
  var pf = ps.frame; var pv = ps.visibleFrame;
  var pmb = (pf.origin.y + pf.size.height) - (pv.origin.y + pv.size.height);
  var vt = vis.origin.y + vis.size.height;
  var ft = frm.origin.y + frm.size.height;
  var mb = (pmb > 0 && Math.abs(vt - ft) < 1) ? pmb : 0;

  JSON.stringify({
    chosenApp: chosen.name, pids: chosen.pids, count: chosen.count,
    screen: {
      x: vis.origin.x,
      y: pH - (vis.origin.y + vis.size.height) + mb,
      width: vis.size.width,
      height: vis.size.height - mb
    }
  });
}`;
  try {
    const { stdout } = await execFileAsync("/usr/bin/osascript", ["-l", "JavaScript", "-e", script]);
    const parsed = JSON.parse(stdout.trim());
    return parsed as ScanResult | null;
  } catch {
    return null;
  }
}

// 一次 AppleScript 调用完成所有窗口位置写入
async function applyFrames(pids: number[], frames: Frame[]): Promise<void> {
  if (frames.length === 0) return;
  const sorted = [...frames].sort((a, b) => a.windowIndex - b.windowIndex);

  const collectBlocks = pids
    .map(
      (pid) => `
    try
      tell (first application process whose unix id is ${pid})
        repeat with w in windows
          try
            if (value of attribute "AXMinimized" of w) is false then set end of visibles to w
          on error
            set end of visibles to w
          end try
        end repeat
      end tell
    end try`,
    )
    .join("\n");

  const setBlocks = sorted
    .map((f) => {
      const idx = f.windowIndex + 1;
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
  set visibles to {}
${collectBlocks}
  ${setBlocks}
end tell`;
  await execFileAsync("/usr/bin/osascript", ["-e", script]);
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
    const scan = await scanAll(appNames);

    if (!scan) {
      toast.style = Toast.Style.Failure;
      toast.title =
        appNames.length > 0
          ? `No tileable windows found (looked for: ${appNames.join(", ")})`
          : "No focused window to detect target app";
      return;
    }

    const grid = layoutFor(scan.count);
    const frames = computeFrames(grid, { width: scan.screen.width, height: scan.screen.height }, gap)
      .filter((f) => f.windowIndex < scan.count)
      .map((f) => ({ ...f, x: f.x + scan.screen.x, y: f.y + scan.screen.y }));

    await applyFrames(scan.pids, frames);

    toast.style = Toast.Style.Success;
    toast.title = `Tiled ${scan.count} ${scan.chosenApp} window${scan.count === 1 ? "" : "s"}`;
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to tile windows";
    toast.message = error instanceof Error ? error.message : String(error);
  }
}
