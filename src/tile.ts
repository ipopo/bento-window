import {
  WindowManagement,
  getPreferenceValues,
  showToast,
  Toast,
} from "@raycast/api";

// 2D 网格表示法：数字 = 窗口序号 (1-based)，0 = 空位，相同数字代表跨格
// 例如 [[1,1,2],[1,1,3]] 表示窗口 1 占左 2x2，窗口 2 在右上，窗口 3 在右下
type LayoutGrid = number[][];

const MAX_WINDOWS = 10;

function layoutFor(count: number): LayoutGrid {
  switch (count) {
    case 1:
      return [[1]];
    case 2:
      return [[1, 2]];
    case 3:
      // 左 2 小 + 右 1 大占满右半屏
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
      // 左 2x2 四个小窗 (各 1/3 宽) + 右 1 列大窗 (1/3 宽 全高)
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
      // 4x2 缺右下角一格
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
      // 3x3
      return [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];
    default:
      // 10 个及以上：5x2
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

  // 求每个窗口编号在网格里的外接矩形
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
    const [windows, desktops, activeWindow] = await Promise.all([
      WindowManagement.getWindowsOnActiveDesktop(),
      WindowManagement.getDesktops(),
      WindowManagement.getActiveWindow().catch(() => null),
    ]);

    // 留空 = 用当前活跃窗口所属 app
    const filterNames =
      appNames.length > 0
        ? appNames
        : activeWindow?.application?.name
          ? [activeWindow.application.name]
          : [];

    if (filterNames.length === 0) {
      toast.style = Toast.Style.Failure;
      toast.title = "No focused window to detect target app";
      return;
    }

    // 选第一个有窗口的 app 进行排布（优先列表顺序）
    let targets: typeof windows = [];
    let chosenApp = "";
    for (const name of filterNames) {
      const matched = windows.filter(
        (w) => w.application?.name === name && w.positionable && w.resizable,
      );
      if (matched.length > 0) {
        targets = matched.slice(0, MAX_WINDOWS);
        chosenApp = name;
        break;
      }
    }

    if (targets.length === 0) {
      toast.style = Toast.Style.Failure;
      toast.title = `No tileable windows found (looked for: ${filterNames.join(", ")})`;
      return;
    }

    const desktopId = targets[0].desktopId;
    const desktop = desktops.find((d) => d.id === desktopId);
    if (!desktop) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not read desktop size";
      return;
    }

    const grid = layoutFor(targets.length);
    const frames = computeFrames(grid, desktop.size, gap);

    await Promise.all(
      frames
        .filter((f) => f.windowIndex < targets.length)
        .map((f) =>
          WindowManagement.setWindowBounds({
            id: targets[f.windowIndex].id,
            desktopId,
            bounds: {
              position: { x: f.x, y: f.y },
              size: { width: f.width, height: f.height },
            },
          }),
        ),
    );

    toast.style = Toast.Style.Success;
    toast.title = `Tiled ${targets.length} ${chosenApp} window${targets.length === 1 ? "" : "s"}`;
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to tile windows";
    toast.message = error instanceof Error ? error.message : String(error);
  }
}
