# `pixi-live2d-display` 可直接挂载模型调研

更新日期：2026-04-10

## 1. 本文目标

本文只回答一个问题：

`哪些模型在技术层面上可以被 pixi-live2d-display 直接使用？`

这里的“直接使用”定义为：

1. 模型入口文件属于 `pixi-live2d-display` 能识别的 Live2D 格式。
2. 使用 Node.js 驱动的真实浏览器加载测试后，`PIXI.live2d.Live2DModel.from(...)` 可以成功完成模型创建。
3. 若失败，则在文档里显式记为“当前实测失败”或“不是 Live2D 格式，不属于这条技术线”。

本文刻意不把重点放在版权是否能上生产站，而只在对应条目补充风险提示。

## 2. 技术边界

### 2.1 当前库支持的模型格式

根据 `pixi-live2d-display` 当前 README.zh：

1. `cubism2.js + live2d.min.js` 支持 Cubism 2.1 模型。
2. `cubism4.js + live2dcubismcore.min.js` 支持 Cubism 3 / Cubism 4 模型。
3. 所以可直接挂载的模型入口主要分两类：
   - `*.model.json` + `*.moc`
   - `*.model3.json` + `*.moc3`

### 2.2 不在这条技术线里的格式

以下格式不属于当前 `pixi-live2d-display` 直挂范围：

1. Spine：`*.json` / `*.skel` + `*.atlas`
2. VRM：`*.vrm`
3. 单纯的 PNG 序列帧或视频资源

这点非常关键，因为“明日方舟小人”这类资源，技术上大多更接近 Spine，而不是 Live2D。

## 3. 本轮实测方法

### 3.1 测试方法

本轮不是只做静态文件判断，而是做了真实浏览器加载测试。

测试链路：

1. 用 Node.js 启动一个极简本地 HTTP 服务。
2. 用 `puppeteer-core` 驱动系统里的 Chrome。
3. 在浏览器页面里动态加载：
   - `pixi.js`
   - `pixi-live2d-display`
   - 对应 Cubism Core
4. 对每个模型入口执行：
   - `PIXI.live2d.Live2DModel.from(modelUrl, options)`
5. 记录是否成功创建模型。

### 3.2 实测环境

本轮环境：

1. Node.js `v24.14.1`
2. npm `11.11.0`
3. 系统浏览器：`/usr/bin/google-chrome`
4. `puppeteer-core@24`

### 3.3 记录脚本

下面是本轮使用的验证脚本。后续要继续扩模型名单时，只需要往 `tests` 数组里追加条目即可。

```js
import http from "node:http";
import puppeteer from "puppeteer-core";

const chromePath = "/usr/bin/google-chrome";

const tests = [
  {
    name: "pixi upstream Shizuku",
    runtime: "cubism2",
    model: "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/shizuku/shizuku.model.json",
  },
  {
    name: "pixi upstream Haru greeter",
    runtime: "cubism4",
    model: "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/haru/haru_greeter_t03.model3.json",
  },
  {
    name: "CubismWebSamples Hiyori",
    runtime: "cubism4",
    model: "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Hiyori/Hiyori.model3.json",
  },
  {
    name: "CubismWebSamples Haru",
    runtime: "cubism4",
    model: "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Haru/Haru.model3.json",
  },
  {
    name: "CubismWebSamples Mao",
    runtime: "cubism4",
    model: "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Mao/Mao.model3.json",
  },
  {
    name: "CubismWebSamples Mark",
    runtime: "cubism4",
    model: "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Mark/Mark.model3.json",
  },
  {
    name: "CubismWebSamples Natori",
    runtime: "cubism4",
    model: "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Natori/Natori.model3.json",
  },
  {
    name: "CubismWebSamples Rice",
    runtime: "cubism4",
    model: "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Rice/Rice.model3.json",
  },
  {
    name: "CubismWebSamples Ren",
    runtime: "cubism4",
    model: "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Ren/Ren.model3.json",
  },
  {
    name: "CubismWebSamples Wanko",
    runtime: "cubism4",
    model: "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Wanko/Wanko.model3.json",
  },
  {
    name: "PRTS Amiya Spine metadata",
    runtime: "cubism4",
    model: "/fixtures/prts-amiya-spine.json",
  },
];

const fixtures = {
  "/fixtures/prts-amiya-spine.json": JSON.stringify({
    prefix: "https://static.prts.wiki/spine/",
    name: "阿米娅",
    skin: {
      默认: {
        战斗正面: {
          file: "char/char_002_amiya/char_002_amiya/char_002_amiya",
        },
      },
    },
  }),
};

function testPage(runtime, model) {
  const cubism2Scripts = `
    <script src="https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism2.min.js"></script>
  `;
  const cubism4Scripts = `
    <script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism4.min.js"></script>
  `;

  return `<!doctype html>
<meta charset="utf-8" />
<canvas id="view" width="800" height="600"></canvas>
<script src="https://pixijs.download/v6.5.10/pixi-legacy.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js"></script>
${runtime === "cubism2" ? cubism2Scripts : cubism4Scripts}
<script>
window.addEventListener("error", (event) => {
  window.__result = { ok: false, stage: "window-error", error: event.message };
});

(async () => {
  try {
    const app = new PIXI.Application({
      view: document.getElementById("view"),
      width: 800,
      height: 600,
      autoStart: false,
      backgroundAlpha: 0,
    });

    const options = { autoUpdate: false };
    if (PIXI.live2d.MotionPreloadStrategy) {
      options.motionPreload = PIXI.live2d.MotionPreloadStrategy.NONE;
    }

    const model = await PIXI.live2d.Live2DModel.from(${JSON.stringify(model)}, options);
    app.stage.addChild(model);
    model.update(16);
    app.render();

    window.__result = {
      ok: true,
      runtime: ${JSON.stringify(runtime)},
      width: model.width,
      height: model.height,
      internalModel: !!model.internalModel,
    };
  } catch (error) {
    window.__result = {
      ok: false,
      runtime: ${JSON.stringify(runtime)},
      error: String(error && (error.stack || error.message || error)),
    };
  }
})();
</script>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/test.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(testPage(url.searchParams.get("runtime"), url.searchParams.get("model")));
    return;
  }
  if (url.pathname in fixtures) {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(fixtures[url.pathname]);
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  for (const test of tests) {
    await page.goto(
      `${base}/test.html?runtime=${encodeURIComponent(test.runtime)}&model=${encodeURIComponent(test.model)}`,
      { waitUntil: "networkidle2" },
    );
    await page.waitForFunction("window.__result !== undefined", { timeout: 20000 });
    const result = await page.evaluate("window.__result");
    console.log(JSON.stringify({ ...test, result }, null, 2));
  }
} finally {
  await browser.close();
  server.close();
}
```

### 3.4 后续扩充办法

如果后面要持续搜集模型，建议按这个规则扩：

1. 新模型优先收集 `model3.json` 或 `model.json` 的直接入口 URL。
2. 每新增一个模型，就加一条 `tests` 记录。
3. 跑完脚本后，把状态落到下面的兼容表里。
4. 把来源标注为：
   - `pixi-upstream`
   - `official-sample`
   - `creator-market`
   - `public-aggregate`
   - `spine-not-live2d`

## 4. 已实测可直接给 `pixi-live2d-display` 的模型

以下模型都已经经过本轮真实加载测试，`Live2DModel.from(...)` 成功。

### 4.1 已实测通过模型总表

说明：

1. “资源类型”主要按实测尺寸比例和官方样例定位做归类，属于工程视角上的使用分类。
2. “Manifest URL” 是直接传给 `Live2DModel.from(...)` 的入口。
3. “资源根目录 URL” 用于你手工检查贴图、动作和相关文件结构。

| 模型 | 资源类型 | Runtime | 入口格式 | Manifest URL | 资源根目录 URL | 来源 | 实测状态 | 风险提示 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Shizuku | 半身 / 桌宠感 | Cubism 2.1 | `model.json + moc` | `https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/shizuku/shizuku.model.json` | `https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/shizuku/` | `pixi-live2d-display` 上游测试资源 | 通过 | 旧格式样例，适合兼容验证，不建议当长期现代主角色 |
| Haru greeter | 全身 | Cubism 4 | `model3.json + moc3` | `https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/haru/haru_greeter_t03.model3.json` | `https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/haru/` | `pixi-live2d-display` 上游测试资源 | 通过 | 与上游 README 体系一致，适合做挂件基准样本 |
| Hiyori | 全身 | Cubism 4 | `model3.json + moc3` | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Hiyori/Hiyori.model3.json` | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Hiyori/` | `Live2D/CubismWebSamples` | 通过 | 官方标准样例 |
| Haru | 全身 | Cubism 4 | `model3.json + moc3` | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Haru/Haru.model3.json` | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Haru/` | `Live2D/CubismWebSamples` | 通过 | 官方标准样例 |
| Mao | 全身 | Cubism 4 | `model3.json + moc3` | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Mao/Mao.model3.json` | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Mao/` | `Live2D/CubismWebSamples` | 通过 | 官方现代样例，适合测试现代效果 |
| Mark | 简化人形 / 半身 | Cubism 4 | `model3.json + moc3` | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Mark/Mark.model3.json` | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Mark/` | `Live2D/CubismWebSamples` | 通过 | 结构简单，适合最小挂件原型 |
| Natori | 全身 | Cubism 4 | `model3.json + moc3` | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Natori/Natori.model3.json` | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Natori/` | `Live2D/CubismWebSamples` | 通过 | Jin Natori 路线样例，资源完整 |
| Rice | 半身 / 横构图 | Cubism 4 | `model3.json + moc3` | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Rice/Rice.model3.json` | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Rice/` | `Live2D/CubismWebSamples` | 通过 | 构图更特别，适合测试非标准挂件布局 |
| Wanko | 吉祥物 / 非人形 | Cubism 4 | `model3.json + moc3` | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Wanko/Wanko.model3.json` | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Wanko/` | `Live2D/CubismWebSamples` | 通过 | 非人形角色，适合测试宠物式挂件 |

### 4.2 最小 JS 加载方式

#### Cubism 4 / `model3.json` 路线

适用于：

1. Haru greeter
2. Hiyori
3. Haru
4. Mao
5. Mark
6. Natori
7. Rice
8. Wanko

```html
<canvas id="view" width="800" height="600"></canvas>
<script src="https://pixijs.download/v6.5.10/pixi-legacy.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js"></script>
<script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism4.min.js"></script>
<script>
  (async () => {
    const app = new PIXI.Application({
      view: document.getElementById("view"),
      width: 800,
      height: 600,
      backgroundAlpha: 0,
    });

    const modelUrl =
      "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Hiyori/Hiyori.model3.json";

    const model = await PIXI.live2d.Live2DModel.from(modelUrl, {
      autoUpdate: true,
      motionPreload: PIXI.live2d.MotionPreloadStrategy.NONE,
    });

    model.anchor.set(0.5, 0.5);
    model.scale.set(0.18);
    model.x = app.screen.width * 0.5;
    model.y = app.screen.height * 0.9;

    app.stage.addChild(model);
  })();
</script>
```

#### Cubism 2.1 / `model.json` 路线

适用于：

1. Shizuku

```html
<canvas id="view" width="800" height="600"></canvas>
<script src="https://pixijs.download/v6.5.10/pixi-legacy.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism2.min.js"></script>
<script>
  (async () => {
    const app = new PIXI.Application({
      view: document.getElementById("view"),
      width: 800,
      height: 600,
      backgroundAlpha: 0,
    });

    const modelUrl =
      "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/shizuku/shizuku.model.json";

    const model = await PIXI.live2d.Live2DModel.from(modelUrl, {
      autoUpdate: true,
    });

    model.anchor.set(0.5, 0.5);
    model.scale.set(0.2);
    model.x = app.screen.width * 0.5;
    model.y = app.screen.height * 0.9;

    app.stage.addChild(model);
  })();
</script>
```

### 4.3 如果你后续要批量加新模型

实践上只看这两个条件就够了：

1. 能拿到 `model3.json` 或 `model.json` 的直接 URL。
2. 这个 URL 打开后，里面的纹理、动作、物理等引用路径是完整的相对路径。

## 5. 已实测当前不能直接用或当前实测失败的条目

| 条目 | 类型 | 实测状态 | 失败原因 |
| --- | --- | --- | --- |
| Ren | Live2D Cubism 4 | 失败 | `pixi-live2d-display` + `cubism4.min.js` 真实加载时抛出 `Unknown error`，当前不能直接列入稳定可用清单 |
| PRTS 阿米娅小人元数据 | Spine 元数据 | 失败 | `Unknown settings format`，因为这不是 `model.json` / `model3.json` 体系 |

## 6. 来源层面的结论

如果只按“能被 `pixi-live2d-display` 直接挂”的技术标准来排，当前最清晰的模型来源是：

1. `pixi-live2d-display` 上游测试资源
2. `Live2D/CubismWebSamples` 的 `Samples/Resources/`
3. Live2D 官方 sample 体系里能拿到 `runtime folder` 的现代模型

这三层有一个共同点：

1. 都能提供真正的 Live2D manifest。
2. 入口文件明确是 `model.json` 或 `model3.json`。
3. 不需要先做格式转换。

## 7. 明日方舟这条线的技术结论

如果你想追求“明日方舟那种小人”，当前调研结果要明确分开看：

1. `pixi-live2d-display` 直挂的是 Live2D 模型。
2. PRTS 上能观察到的明日方舟小人资源，技术上更接近 Spine。
3. 所以“明日方舟小人”不是当前这条 Live2D 兼容清单里的条目，而是另一条技术路线。

换句话说：

1. 想要 `pixi-live2d-display` 直接挂载，就去找 `model3.json / model.json`。
2. 想要明日方舟小人质感，就要单独考虑 Spine。

## 8. 当前推荐的直接可用种子池

如果只为了尽快搭一个可扩展的挂件资源库，建议先从这些模型开始积累：

1. `Shizuku`
2. `Haru greeter`
3. `Hiyori`
4. `Haru`
5. `Mao`
6. `Mark`
7. `Natori`
8. `Rice`
9. `Wanko`

这批条目已经满足：

1. 有明确入口文件。
2. 已经过本轮真实加载测试。
3. 可以直接作为后续模型名单的初始种子池。

## 9. 官方样例线尚未补测的知名角色

这些角色在 Live2D 官方 sample 生态里是明确存在的，但这里说的“待验证”只针对官方样例线本身，不代表全网都还没有可用模型。

例如 `Hatsune Miku` 已经在第 13.5 节和第 13.6 节通过社区仓实测；这里仅表示“官方 sample 生态里可直接拿来复验的 runtime manifest”本轮仍未补齐。

| 角色 | 当前状态 | 说明 |
| --- | --- | --- |
| Hatsune Miku | 官方样例线待验证 | 社区仓已实测可用，但官方 sample 生态里本轮没有把其 runtime manifest 直链纳入已测矩阵 |
| Unity-chan | 官方样例线待验证 | 官方 sample 生态里可见，但本轮没有把其 runtime manifest 直链纳入已测矩阵 |
| Chitose | 官方样例线待验证 | 官方旧样例角色，本轮未纳入已测矩阵 |
| Epsilon | 官方样例线待验证 | 官方旧样例角色，本轮未纳入已测矩阵 |
| Hibiki | 官方样例线待验证 | 官方旧样例角色，本轮未纳入已测矩阵 |
| Koharu & Haruto | 官方样例线待验证 | 官方旧样例组合角色，本轮未纳入已测矩阵 |

后续如果要把“官方来源”这一列也补齐，优先级仍然建议先做 `Hatsune Miku` 和 `Unity-chan`，但前提仍然是先拿到可直接测试的 `model3.json` / `model.json`，不能只拿到 `cmo3` / `can3` 这类编辑工程文件。

## 10. 下一步建议

如果后续要把“模型池越攒越多”，推荐工作流是：

1. 先收集可直链访问的 `model3.json` / `model.json`。
2. 用本文脚本批量跑一遍。
3. 把结果归档成三类：
   - `实测可用`
   - `格式属于 Live2D 但当前实测失败`
   - `不是 Live2D，不属于 pixi-live2d-display 直接输入`
4. 再决定哪些值得进入站点挂件候选池。

## 11. 仓库内复验脚本

本轮已把复验脚本收敛到仓库内：

- `scripts/validate_live2d_models.mjs`

它支持三类输入：

1. 单个本地 manifest 文件
2. 一个包含大量 manifest 的本地目录
3. 远程 manifest URL

### 11.1 常用命令

#### 全量验证某个本地仓库

```bash
node scripts/validate_live2d_models.mjs \
  --output /tmp/cue-live2d-results.json \
  /tmp/live2d-more/CUE-live2d-Viewer/live2d

node scripts/validate_live2d_models.mjs \
  --output /tmp/azurlane-live2d-results.json \
  /tmp/live2d-more/AzurLane-Live2D/live2d
```

#### 验证少量候选或指定 URL

```bash
node scripts/validate_live2d_models.mjs \
  --timeout 45000 \
  --output /tmp/remote-retry-results.json \
  https://cdn.jsdelivr.net/gh/donjuanplatinum/AzurLane-Live2D@master/live2d/z23/z23.model3.json \
  https://raw.githubusercontent.com/Cpk0521/CUE-live2d-Viewer/master/live2d/001/001_001/001.model3.json
```

#### 只抽查某类路径

```bash
node scripts/validate_live2d_models.mjs \
  --match lafei \
  /tmp/live2d-more/AzurLane-Live2D/live2d
```

### 11.2 输出含义

脚本每行输出一个 JSON 结果，核心字段如下：

1. `manifest`：被测试的 manifest 路径或 URL
2. `runtime`：`cubism2` 或 `cubism4`
3. `source`：`local` 或 `remote`
4. `durationMs`：完成或失败所耗时
5. `result.ok`：是否成功创建 `Live2DModel`

这意味着后续只要再找到新的公开模型池，就可以继续用同一个脚本批量补测。

## 12. 第二轮补测总表

这一轮重点不再只是“格式看起来像不像 Live2D”，而是明确区分：

1. `下载后本地可直接挂载`
2. `远程 URL 当前可直接挂载`
3. `资源存在，但下载后不能直接挂载`
4. `根本不是 Live2D 格式`

### 12.1 仓库级结论

| 来源仓库 / 资源池 | Manifest 数量 | 下载后本地直挂结果 | 远程直挂补测 | 当前结论 |
| --- | --- | --- | --- | --- |
| `pixi-live2d-display` 上游 + `Live2D/CubismWebSamples` | 9 个基准样本 | 已通过 | 已通过 | 继续作为最稳的官方 / 上游基准池 |
| `Cpk0521/CUE-live2d-Viewer` | `195` | `195 / 195` 通过 | 抽测 `0 / 2` 通过 | 技术上完全可用，但更适合先下载后自托管 |
| `donjuanplatinum/AzurLane-Live2D` | `193`，代表条目补到 `16` 个 | `193 / 193` 通过；本轮新增 `8 / 8` 通过 | 抽测 `1 / 4` 通过 | 技术上完全可用，远程直挂稳定性一般 |
| `Eikanya/Live2d-model` | 本轮只抽测 8 个代表条目 | `8 / 8` 通过 | 未系统补测 | 可以视为公开 Live2D 聚合仓，但必须逐条复验 |
| `KISGP/model` | 本轮补齐 `16` 个著名 IP 条目 | `16 / 16` 通过 | 未补测 | `星穹铁道 6 + 崩坏学园 2 10` 这一线已补到整组可用 |
| `zenghongtu/live2d-model-assets` | 累计补齐 `38` 个著名 IP 条目 | `38 / 38` 通过 | 未补测 | `少女前线 26 + 海王星 10 + Miku 2` 可以继续当主力资源池 |
| `lezzthanthree/SEKAI-Stories` | 累计补齐 `33` 个著名 IP 条目 | `33 / 33` 通过 | 未补测 | `Project SEKAI / Vocaloid` 主角色基础款 + 服装变体都很稳 |
| `diannaojiang/bandream_l2d` | 本轮抽测 `10` 个著名 IP 条目 | `0 / 10` 通过 | 未补测 | 角色知名度高，但当前 manifest 贴图路径不匹配 |
| `stories2/BlueArchive` + `respectZ/blue-archive-viewer` | 未发现可直挂 manifest | 不适用 | 不适用 | `Blue Archive` 当前拿到的是 `cmo3/can3` 编辑工程或 Spine 资源，不是 `pixi-live2d-display` 直挂输入 |
| `namv22/GFL-Live2D-Viewer` | `86` 个 manifest 存在 | 抽测 `0 / 6` 通过 | 此前远程抽测 `0 / 4` 通过 | 下载后不能直接挂，manifest 与实际文件名不匹配 |
| PRTS 明日方舟小人页 | 不是 Live2D manifest | 不适用 | 不适用 | 这条线仍然是 Spine，不属于 `pixi-live2d-display` 直挂输入 |
| `Halyul/aklive2d` | 未发现可直挂 Live2D manifest | 不适用 | 不适用 | 明日方舟候选仓，实际是 `spine-webgl` 展示方案，不属于 `pixi-live2d-display` 直挂输入 |

### 12.2 这轮最重要的新发现

如果只按“技术上能否直接给 `pixi-live2d-display`”这个标准，这一轮真正值得记住的是：

1. `donjuanplatinum/AzurLane-Live2D`：在整仓本地已过的基础上，本轮又逐条补了贝尔法斯特、俾斯麦、独角兽、宁海、平海、提尔比茨、翔鹤、Z46 这 `8` 个高知名角色，新增 `8 / 8` 全过。
2. `KISGP/model`：`星穹铁道 6` 个 + `崩坏学园 2 10` 个条目，本地 `16 / 16` 全过，`BengHuai2` 这一子目录已经补齐。
3. `zenghongtu/live2d-model-assets`：现在累计到 `少女前线 26` 个 + `海王星 10` 个 + `Miku 2` 个，本地 `38 / 38` 全过，是当前著名 IP 密度最高的来源之一。
4. `lezzthanthree/SEKAI-Stories`：现在累计到 `33` 个条目，本轮补的 `Project SEKAI` 主角色基础款 `15 / 15` 全过，说明它不只是服装变体稳定，基础主角池也稳定。
5. `Halyul/aklive2d`：明日方舟方向这轮继续按最高优先级追了，但它实际是 `spine-webgl` 展示方案，没有进入 `pixi-live2d-display` 直挂表。
6. `stories2/BlueArchive` + `respectZ/blue-archive-viewer`：`Blue Archive` 方向本轮也追了，但前者只有 `cmo3/can3` 编辑工程，后者是 Spine 资源，仍然不能进入 `pixi-live2d-display` 直挂表。
7. `diannaojiang/bandream_l2d`：角色本身很有价值，但当前仓库形态不是“下载后即可直挂”。
8. `CUE-live2d-Viewer`、`AzurLane-Live2D`、`Eikanya/Live2d-model` 仍然是继续扩表时最稳的主力来源。

这意味着后面真要持续攒模型池，可以优先盯住：

1. 官方 sample
2. `CUE-live2d-Viewer`
3. `AzurLane-Live2D`
4. `Eikanya/Live2d-model`
5. `KISGP/model`
6. `zenghongtu/live2d-model-assets`
7. `lezzthanthree/SEKAI-Stories`

但如果目标是“多找著名 IP”，那也要同步接受一个现实：

1. `Blue Archive` 这类热门 IP 当前更容易搜到的是 Spine 或 Cubism 编辑工程，不一定能直接进 `pixi-live2d-display`。
2. 所以“著名 IP 优先”并不等于“只搜新 IP”，从已经跑通的大仓里继续补高知名角色，通常比追未知仓更稳。

## 13. 新增确认可用模型表

说明：

1. 第 4 节已经给过官方与上游基准模型。
2. 这里补的是第二轮新增确认条目。
3. “Manifest URL” 优先给出可下载入口；若远程直挂不稳定，会在“远程直挂补测”里明确写失败。
4. “资源类型”是工程角度下的使用归类，不是官方标签。

### 13.1 `Eikanya/Live2d-model` 中本轮跑通的代表条目

| 模型 | 资源类型 | 实测尺寸 | Runtime | Manifest URL | 下载后本地直挂 | 远程直挂补测 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Senko | 半身 / 桌宠风 | `3505 x 3003` | Cubism 4 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/Live2D/Senko_Normals/senko.model3.json` | 通过 | 未补测 | `The Helpful Fox Senko-san` 路线，适合右下角挂件 |
| Fox Hime Zero `mori_miko` | 全身 | `2160 x 3840` | Cubism 4 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/galgame%20live2d/Fox%20Hime%20Zero/mori_miko/mori_miko.model3.json` | 通过 | 未补测 | 标准竖向全身立绘 |
| Fox Hime Zero `mori_mikoc` | 全身 | `2160 x 3840` | Cubism 4 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/galgame%20live2d/Fox%20Hime%20Zero/mori_mikoc/mori_mikoc.model3.json` | 通过 | 未补测 | 同系列变体 |
| Fox Hime Zero `mori_mikocfs` | 全身 | `2160 x 3840` | Cubism 4 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/galgame%20live2d/Fox%20Hime%20Zero/mori_mikocfs/mori_mikocfs.model3.json` | 通过 | 未补测 | 同系列变体 |
| Fox Hime Zero `mori_suit` | 全身 | `2160 x 3840` | Cubism 4 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/galgame%20live2d/Fox%20Hime%20Zero/mori_suit/mori_suit.model3.json` | 通过 | 未补测 | 同系列变体 |
| Fox Hime Zero `ruri_miko` | 全身 | `2160 x 3840` | Cubism 4 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/galgame%20live2d/Fox%20Hime%20Zero/ruri_miko/ruri_miko.model3.json` | 通过 | 未补测 | 双纹理，细节量更高 |
| BanG Dream! `001_miku_romecin` | 半身 / 角色立绘 | `2000 x 2500` | Cubism 2.1 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/BanG%20Dream!/asneeded/live2d/chara/001/001_miku_romecin/.model.json` | 通过 | 未补测 | 老格式 `model.json + moc` |
| BanG Dream! `001_2018_dog` | 半身 / 角色立绘 | `2000 x 2500` | Cubism 2.1 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/BanG%20Dream!/asneeded/live2d/chara/001/001_2018_dog/.model.json` | 通过 | 未补测 | 老格式 `model.json + moc` |

### 13.2 `AzurLane-Live2D` 中优先推荐的代表条目

先给结论：

1. 整仓 `193 / 193` 本地通过。
2. 远程直挂不稳定，不适合直接把原仓库 URL 当生产资源。
3. 这批资源非常适合作为“先下载到自己站点或对象存储，再本地 / 自家 CDN 挂载”的来源。

原始仓库 URL 模式：

```txt
raw:      https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/<folder>/<folder>.model3.json
jsDelivr: https://cdn.jsdelivr.net/gh/donjuanplatinum/AzurLane-Live2D@master/live2d/<folder>/<folder>.model3.json
```

| 模型 | 资源类型 | 实测尺寸 | Runtime | Manifest URL | 下载后本地直挂 | 远程直挂补测 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 拉菲 `lafei` | 方构图 / 小挂件感 | `1200 x 1200` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/lafei/lafei.model3.json` | 通过 | `raw` 超时，`jsDelivr` 超时 | 适合做右下角悬浮挂件 |
| Z23 `z23` | 方构图 / 小挂件感 | `1200 x 1200` | Cubism 4 | `https://cdn.jsdelivr.net/gh/donjuanplatinum/AzurLane-Live2D@master/live2d/z23/z23.model3.json` | 通过 | `jsDelivr` 通过，`raw` 超时 | 本轮唯一补测到远程直挂成功的碧蓝航线条目 |
| 标枪 `biaoqiang` | 方构图 / 小挂件感 | `1200 x 1200` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/biaoqiang/biaoqiang.model3.json` | 通过 | 未补测 | 纹理数 `7`，资源较完整 |
| 凌波 `lingbo` | 方构图 / 小挂件感 | `1200 x 1200` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/lingbo/lingbo.model3.json` | 通过 | 未补测 | 纹理数 `4` |
| 明石 `mingshi` | 方构图 / 小挂件感 | `1200 x 1200` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/mingshi/mingshi.model3.json` | 通过 | 未补测 | 单纹理，轻量 |
| 雪风 `xuefeng` | 方构图 / 小挂件感 | `1200 x 1200` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/xuefeng/xuefeng.model3.json` | 通过 | 未补测 | 纹理数 `6` |
| 企业 `qiye_7` | 全身 | `10500 x 10000` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/qiye_7/qiye_7.model3.json` | 通过 | 未补测 | 大尺寸现代立绘 |
| 大凤 `dafeng_4` | 全身 | `7000 x 7300` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/dafeng_4/dafeng_4.model3.json` | 通过 | 未补测 | 适合测试复杂互动角色 |

#### 13.2.1 本轮追加跑通的高知名角色

这 8 个条目本轮都是从下载后的本地目录逐条重新跑过的，不是按同仓规律外推：

| 模型 | 资源类型 | 实测尺寸 | Runtime | Manifest URL | 下载后本地直挂 | 远程直挂补测 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 贝尔法斯特 `beierfasite_2` | 全身 / 大立绘 | `3508 x 4961` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/beierfasite_2/beierfasite_2.model3.json` | 通过 | 未补测 | 经典女仆角色代表条目 |
| 俾斯麦 `bisimai_2` | 全身 / 大立绘 | `7197 x 7625` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/bisimai_2/bisimai_2.model3.json` | 通过 | 未补测 | 大尺寸单纹理条目 |
| 独角兽 `dujiaoshou_4` | 方构图 / 角色立绘 | `5000 x 5000` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/dujiaoshou_4/dujiaoshou_4.model3.json` | 通过 | 未补测 | 大方图，做挂件裁切也友好 |
| 宁海 `ninghai_4` | 横构图 / 角色立绘 | `6000 x 5000` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/ninghai_4/ninghai_4.model3.json` | 通过 | 未补测 | 与平海形成成对条目 |
| 平海 `pinghai_4` | 横构图 / 角色立绘 | `6000 x 5000` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/pinghai_4/pinghai_4.model3.json` | 通过 | 未补测 | 与宁海同组，比例一致 |
| 提尔比茨 `tierbici_2` | 方构图 / 小挂件感 | `1700 x 1700` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/tierbici_2/tierbici_2.model3.json` | 通过 | 未补测 | 双纹理，小尺寸里结构最紧凑的一类 |
| 翔鹤 `xianghe_2` | 方构图 / 大立绘 | `7000 x 7000` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/xianghe_2/xianghe_2.model3.json` | 通过 | 未补测 | 高分辨率单纹理条目 |
| Z46 `z46_3` | 方构图 / 大立绘 | `7000 x 7000` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/z46_3/z46_3.model3.json` | 通过 | 未补测 | 著名驱逐舰角色代表条目 |

### 13.3 `CUE-live2d-Viewer` 中优先保留的代表条目

先给结论：

1. 整仓 `195 / 195` 本地通过。
2. 远程直挂至少在本轮补测里仍然稳定超时。
3. 所以这也是“下载后自托管”的典型资源池。

原始仓库 URL 模式：

```txt
raw:      https://raw.githubusercontent.com/Cpk0521/CUE-live2d-Viewer/master/live2d/<charId>/<skinId>/<charId>.model3.json
jsDelivr: https://cdn.jsdelivr.net/gh/Cpk0521/CUE-live2d-Viewer@master/live2d/<charId>/<skinId>/<charId>.model3.json
```

| 模型 | 资源类型 | 实测尺寸 | Runtime | Manifest URL | 下载后本地直挂 | 远程直挂补测 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `001 / 001_001` | 全身 | `3039 x 4298` | Cubism 4 | `https://raw.githubusercontent.com/Cpk0521/CUE-live2d-Viewer/master/live2d/001/001_001/001.model3.json` | 通过 | `raw` 超时，`jsDelivr` 超时 | 这是本轮重试过的首个 CUE 条目 |
| `016 / 016_013` | 全身 | `3039 x 4298` | Cubism 4 | `https://raw.githubusercontent.com/Cpk0521/CUE-live2d-Viewer/master/live2d/016/016_013/016.model3.json` | 通过 | 未补测 | 同仓库内路径规律稳定 |
| `103 / 103_001` | 全身 | `3039 x 4298` | Cubism 4 | `https://raw.githubusercontent.com/Cpk0521/CUE-live2d-Viewer/master/live2d/103/103_001/103.model3.json` | 通过 | 未补测 | 说明后段编号资源也不是“前面几条特例” |

### 13.4 `KISGP/model` 中本轮跑通的著名 IP 条目

先给结论：

1. 本轮补齐后的 `16` 个代表条目全部通过。
2. 这条线已经不只是“杂项聚合仓”，而是可以稳定产出著名 IP 的可挂模型。
3. 其中 `星穹铁道` 是现代 `Cubism 4`，`崩坏学园 2` 这一组是老格式 `Cubism 2.1`。

| IP | 模型 | 资源类型 | 实测尺寸 | Runtime | Manifest URL | 下载后本地直挂 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `崩坏学园 2` | 布洛妮娅 `bronya` | 方构图 / 角色立绘 | `2500 x 2500` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/bronya/model.json` | 通过 | 方构图稳定，适合桌宠化裁切 |
| `崩坏学园 2` | 八重樱 `BYC` | 方构图 / 角色立绘 | `2480 x 2480` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/BYC/model.json` | 通过 | 接近方图，挂件友好 |
| `崩坏学园 2` | 耀夜姬 `kaguya` | 方构图 / 角色立绘 | `2000 x 2100` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/kaguya/model.json` | 通过 | 老格式但资源完整 |
| `崩坏学园 2` | 时雨绮罗 `Kiro` | 方构图 / 角色立绘 | `2000 x 2000` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/Kiro/model.json` | 通过 | 最接近标准桌宠方图 |
| `崩坏学园 2` | 丽塔 `Lita` | 竖向角色立绘 | `1800 x 2000` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/Lita/model.json` | 通过 | 竖向比例更适合侧栏挂件 |
| `崩坏学园 2` | 希儿 `xier` | 竖向角色立绘 | `1400 x 2700` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/xier/model.json` | 通过 | 细高构图，适合全身展示 |
| `崩坏学园 2` | `keluoyi` | 方构图 / 角色立绘 | `2000 x 2000` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/keluoyi/model.json` | 通过 | 轻量方图，适合补齐老格式角色池 |
| `崩坏学园 2` | `Nindi` | 细高全身 | `2806 x 5332` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/Nindi/model.json` | 通过 | 这组里最高的竖向立绘之一 |
| `崩坏学园 2` | 西琳 `xilin2.1` | 竖向角色立绘 | `3000 x 3500` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/xilin2.1/model.json` | 通过 | 比例稳定，适合全身展示 |
| `崩坏学园 2` | 伊瑟琳 `yiselin` | 竖向角色立绘 | `2500 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/yiselin/model.json` | 通过 | 补齐后 `BengHuai2` 子目录达到 `10 / 10` 通过 |
| `崩坏：星穹铁道` | 卡夫卡 | 全身 / 大立绘 | `3326 x 6162` | Cubism 4 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/StarRail/卡夫卡/卡夫卡.model3.json` | 通过 | 这轮首个跑通的星铁条目 |
| `崩坏：星穹铁道` | 知更鸟 | 全身 / 大立绘 | `6363 x 9000` | Cubism 4 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/StarRail/知更鸟/知更鸟.model3.json` | 通过 | 高分辨率双纹理条目 |
| `崩坏：星穹铁道` | 符玄 | 全身 / 大立绘 | `6000 x 8487` | Cubism 4 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/StarRail/符玄/符玄.model3.json` | 通过 | 纹理数 `8`，复杂度较高 |
| `崩坏：星穹铁道` | 花火 | 全身 / 大立绘 | `3836 x 4750` | Cubism 4 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/StarRail/花火/花火.model3.json` | 通过 | 尺寸更紧凑，适合中型挂件 |
| `崩坏：星穹铁道` | 藿藿 | 全身 / 大立绘 | `6000 x 8487` | Cubism 4 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/StarRail/藿藿/藿藿.model3.json` | 通过 | 纹理数 `4` |
| `崩坏：星穹铁道` | 镜流 | 全身 / 大立绘 | `3454 x 4160` | Cubism 4 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/StarRail/镜流/镜流.model3.json` | 通过 | 单纹理，轻量于大多数星铁条目 |

### 13.5 `zenghongtu/live2d-model-assets` 中本轮跑通的著名 IP 条目

先给结论：

1. 累计补齐后的 `38` 个代表条目全部通过。
2. 这条线的价值在于它能一次性提供多个著名二次元 IP。
3. 当前抽测到的通过项全部是 `Cubism 2.1`。

#### 13.5.1 `少女前线`

| 模型 | 资源类型 | 实测尺寸 | Runtime | Manifest URL | 下载后本地直挂 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 95 式 `95type_405` | 方构图 / 桌宠感 | `1024 x 1024` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/95type_405/95type_405.model.json` | 通过 | 这批里最接近小挂件尺寸 |
| AK-12 `ak12_3302` | 全身 / 大立绘 | `4000 x 5813` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/ak12_3302/ak12_3302.model.json` | 通过 | 大竖图 |
| AN-94 `an94_3303` | 全身 / 大立绘 | `3000 x 4360` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/an94_3303/an94_3303.model.json` | 通过 | 与 AK-12 形成配套代表样本 |
| G36C `g36c_1202` | 全身 / 大立绘 | `2757 x 4130` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/g36c_1202/g36c_1202.model.json` | 通过 | 比例更适中 |
| HK416 `hk416_3401` | 全身 / 大立绘 | `3500 x 5000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/hk416_3401/hk416_3401.model.json` | 通过 | 著名角色代表条目 |
| OTs-14 `ots14_3001` | 全身 / 大立绘 | `4800 x 5328` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/ots14_3001/ots14_3001.model.json` | 通过 | 宽一些的全身构图 |
| UMP45 `ump45_3403` | 全身 / 角色立绘 | `2480 x 3861` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/ump45_3403/ump45_3403.model.json` | 通过 | 中等尺寸 |
| WA2000 `wa2000_6` | 方构图 / 角色立绘 | `1920 x 1920` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/wa2000_6/wa2000_6.model.json` | 通过 | 方图，适合挂件裁切 |
| G41 `g41_2401` | 全身 / 大立绘 | `5000 x 6000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/g41_2401/g41_2401.model.json` | 通过 | 这组里分辨率最高的少女前线条目之一 |
| 格琳娜 `gelina` | 全身 / 角色立绘 | `3400 x 3826` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/gelina/gelina.model.json` | 通过 | 辨识度很高的副官角色 |
| SAT8 `sat8_2601` | 横构图 / 角色立绘 | `5190 x 3508` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/sat8_2601/sat8_2601.model.json` | 通过 | 宽构图版本，适合横向展示区 |
| SAT8 `sat8_3602` | 全身 / 大立绘 | `3508 x 4961` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/sat8_3602/sat8_3602.model.json` | 通过 | 同角色的竖向版本 |
| UMP9 `ump9_3404` | 全身 / 角色立绘 | `2480 x 3861` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/ump9_3404/ump9_3404.model.json` | 通过 | 可与 `UMP45` 组成配对条目 |
| Vector `vector_1901` | 宽构图 / 角色立绘 | `3661 x 3900` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/vector_1901/vector_1901.model.json` | 通过 | 接近方图但横向更宽一点 |
| Welrod `welrod_1401` | 方构图 / 角色立绘 | `3500 x 3600` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/welrod_1401/welrod_1401.model.json` | 通过 | 接近方图，做挂件裁切也比较友好 |

##### 13.5.1.1 本轮追加跑通的少女前线角色

这 11 个条目本轮也是逐条从下载后的本地目录跑过的：

| 模型 | 资源类型 | 实测尺寸 | Runtime | Manifest URL | 下载后本地直挂 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| AA-12 `aa12_2403` | 全身 / 大立绘 | `6000 x 7000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/aa12_2403/aa12_2403.model.json` | 通过 | 大型竖向立绘 |
| Carcano M1891 `carcano1891_2201` | 全身 / 角色立绘 | `2480 x 3508` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/carcano1891_2201/carcano1891_2201.model.json` | 通过 | Carcano 姐妹之一 |
| Carcano M1938 `carcano1938_2202` | 全身 / 角色立绘 | `2480 x 3508` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/carcano1938_2202/carcano1938_2202.model.json` | 通过 | 与 `M1891` 构成配套条目 |
| Contender `contender_2302` | 全身 / 角色立绘 | `2480 x 3508` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/contender_2302/contender_2302.model.json` | 通过 | 中等尺寸，适合常规侧栏挂件 |
| DSR-50 `dsr50_1801` | 全身 / 大立绘 | `5000 x 6036` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/dsr50_1801/dsr50_1801.model.json` | 通过 | 高分辨率代表条目 |
| FN-57 `fn57_2203` | 全身 / 大立绘 | `5000 x 6500` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/fn57_2203/fn57_2203.model.json` | 通过 | 细高比例，更适合全身展示 |
| Grizzly `grizzly_2102` | 全身 / 大立绘 | `4500 x 6000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/grizzly_2102/grizzly_2102.model.json` | 通过 | 高辨识度角色之一 |
| K2 `k2_3301` | 横构图 / 角色立绘 | `4522 x 4300` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/k2_3301/k2_3301.model.json` | 通过 | 比大多数 GFL 条目更接近横构图 |
| NTW-20 `ntw20_2301` | 全身 / 角色立绘 | `2480 x 3507` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/ntw20_2301/ntw20_2301.model.json` | 通过 | 细高比例稳定 |
| Px4 Storm `px4storm_2801` | 全身 / 大立绘 | `3480 x 4923` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/px4storm_2801/px4storm_2801.model.json` | 通过 | 中大型竖向立绘 |
| RFB `rfb_1601` | 全身 / 大立绘 | `4213 x 5797` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/rfb_1601/rfb_1601.model.json` | 通过 | 著名 AR 角色补充条目 |

#### 13.5.2 `超次元海王星`

| 模型 | 资源类型 | 实测尺寸 | Runtime | Manifest URL | 下载后本地直挂 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| Neptune `nepnep` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/nepnep/model.json` | 通过 | 本轮最经典的海王星代表条目 |
| Nepgear `nepgear` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/nepgear/model.json` | 通过 | 四纹理 |
| Noir `noir` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/noir/model.json` | 通过 | 三纹理 |
| Blanc `blanc_normal` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/blanc_normal/model.json` | 通过 | 四纹理 |
| Vert `vert_normal` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/vert_normal/model.json` | 通过 | 四纹理 |
| Neptune 圣诞 `neptune_santa` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/neptune_santa/model.json` | 通过 | 经典角色节日变体 |
| Nepgear 泳装 `nepgearswim` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/nepgearswim/model.json` | 通过 | 四纹理，复杂度与基础版一致 |
| Noir 圣诞 `noir_santa` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/noir_santa/model.json` | 通过 | 经典角色节日变体 |
| Blanc 泳装 `blanc_swimwear` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/blanc_swimwear/model.json` | 通过 | 三纹理，略轻于基础版 |
| Vert 泳装 `vert_swimwear` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/vert_swimwear/model.json` | 通过 | 四纹理，适合作为变体补充 |

#### 13.5.3 `Vocaloid / Miku`

| 模型 | 资源类型 | 实测尺寸 | Runtime | Manifest URL | 下载后本地直挂 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 初音未来 `miku` | 半身 / 轻量挂件 | `900 x 1200` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/miku/miku.model.json` | 通过 | 轻量级老格式代表条目 |
| Snow Miku | 横构图 / 大立绘 | `4000 x 3200` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/snow_miku/model.json` | 通过 | 著名 Miku 变体 |

### 13.6 `SEKAI-Stories` 中本轮跑通的著名 IP 条目

先给结论：

1. 累计补齐后的 `33` 个代表条目全部通过。
2. 这条线现在可以当作 `Project SEKAI / Vocaloid` 的稳定现代模型池。
3. 当前抽测条目全部是 `Cubism 4`，尺寸一致性也很好。

| 模型 | 资源类型 | 实测尺寸 | Runtime | Manifest URL | 下载后本地直挂 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 草薙宁宁 `15nene_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/15nene/15nene_normal/15nene_normal.model3.json` | 通过 | `Wonderlands x Showtime` 路线 |
| 神代类 `16rui_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/16rui/16rui_normal/16rui_normal.model3.json` | 通过 | 与宁宁同 IP 路线 |
| 朝比奈真冬 `18mafuyu_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/18mafuyu/18mafuyu_normal/18mafuyu_normal.model3.json` | 通过 | `25 时，Nightcord 见` 路线 |
| 初音未来 `21miku_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/21miku/21miku_normal/21miku_normal.model3.json` | 通过 | 现代 `Miku` 样本，优先级很高 |
| 镜音连 `23len_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/23len/23len_normal/23len_normal.model3.json` | 通过 | Vocaloid 代表条目 |
| 巡音流歌 `24luka_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/24luka/24luka_normal/24luka_normal.model3.json` | 通过 | Vocaloid 代表条目 |
| MEIKO `25meiko_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/25meiko/25meiko_normal/25meiko_normal.model3.json` | 通过 | Vocaloid 代表条目 |
| KAITO `26kaito_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/26kaito/26kaito_normal/26kaito_normal.model3.json` | 通过 | Vocaloid 代表条目 |

#### 13.6.1 本轮追加跑通的 `Project SEKAI / Vocaloid` 服装变体

这 10 个条目本轮都是重新逐条跑过的，不是“从目录结构推断会通过”：

| 模型 | 资源类型 | 实测尺寸 | Runtime | Manifest URL | 下载后本地直挂 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 初音未来 `21miku_band` | 全身 / 乐队风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/21miku/21miku_band/21miku_band.model3.json` | 通过 | 适合补齐 `Leo/need` 路线 |
| 初音未来 `21miku_idol` | 全身 / 偶像风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/21miku/21miku_idol/21miku_idol.model3.json` | 通过 | 适合补齐 `MORE MORE JUMP!` 路线 |
| 初音未来 `21miku_night` | 全身 / 夜曲风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/21miku/21miku_night/21miku_night.model3.json` | 通过 | `25 时，Nightcord 见` 路线变体 |
| 初音未来 `21miku_street` | 全身 / 街头风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/21miku/21miku_street/21miku_street.model3.json` | 通过 | `Vivid BAD SQUAD` 路线变体 |
| 初音未来 `21miku_wonder` | 全身 / 游乐舞台风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/21miku/21miku_wonder/21miku_wonder.model3.json` | 通过 | `Wonderlands x Showtime` 路线变体 |
| 镜音连 `23len_band` | 全身 / 乐队风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/23len/23len_band/23len_band.model3.json` | 通过 | 与 `Miku band` 风格对应 |
| 镜音连 `23len_wonder` | 全身 / 游乐舞台风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/23len/23len_wonder/23len_wonder.model3.json` | 通过 | 与 `Wonderlands x Showtime` 路线对应 |
| 巡音流歌 `24luka_night` | 全身 / 夜曲风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/24luka/24luka_night/24luka_night.model3.json` | 通过 | 与 `Nightcord` 路线对应 |
| MEIKO `25meiko_wonder` | 全身 / 游乐舞台风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/25meiko/25meiko_wonder/25meiko_wonder.model3.json` | 通过 | `Wonder` 方向代表条目 |
| KAITO `26kaito_band` | 全身 / 乐队风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/26kaito/26kaito_band/26kaito_band.model3.json` | 通过 | 说明男 Vocaloid 变体也同样稳定 |

#### 13.6.2 本轮追加跑通的 `Project SEKAI` 主角色基础款

这 15 个基础款条目本轮也都是逐条从本地目录跑过的，不是按同角色服装线外推：

| 模型 | 资源类型 | 实测尺寸 | Runtime | Manifest URL | 下载后本地直挂 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 星乃一歌 `01ichika_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/01ichika/01ichika_normal/01ichika_normal.model3.json` | 通过 | `Leo/need` 主唱路线 |
| 天马咲希 `02saki_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/02saki/02saki_normal/02saki_normal.model3.json` | 通过 | `Leo/need` 基础角色 |
| 望月穗波 `03honami_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/03honami/03honami_normal/03honami_normal.model3.json` | 通过 | `Leo/need` 基础角色 |
| 日野森志步 `04shiho_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/04shiho/04shiho_normal/04shiho_normal.model3.json` | 通过 | `Leo/need` 基础角色 |
| 花里实乃理 `05minori_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/05minori/05minori_normal/05minori_normal.model3.json` | 通过 | `MORE MORE JUMP!` 基础角色 |
| 桐谷遥 `06haruka_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/06haruka/06haruka_normal/06haruka_normal.model3.json` | 通过 | `MORE MORE JUMP!` 基础角色 |
| 桃井爱莉 `07airi_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/07airi/07airi_normal/07airi_normal.model3.json` | 通过 | `MORE MORE JUMP!` 基础角色 |
| 日野森雫 `08shizuku_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/08shizuku/08shizuku_normal/08shizuku_normal.model3.json` | 通过 | `MORE MORE JUMP!` 基础角色 |
| 小豆泽心羽 `09kohane_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/09kohane/09kohane_normal/09kohane_normal.model3.json` | 通过 | `Vivid BAD SQUAD` 基础角色 |
| 白石杏 `10an_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/10an/10an_normal/10an_normal.model3.json` | 通过 | `Vivid BAD SQUAD` 基础角色 |
| 东云彰人 `11akito_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/11akito/11akito_normal/11akito_normal.model3.json` | 通过 | `Vivid BAD SQUAD` 基础角色 |
| 青柳冬弥 `12touya_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/12touya/12touya_normal/12touya_normal.model3.json` | 通过 | `Vivid BAD SQUAD` 基础角色 |
| 天马司 `13tsukasa_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/13tsukasa/13tsukasa_normal/13tsukasa_normal.model3.json` | 通过 | `Wonderlands x Showtime` 主角路线 |
| 凤笑梦 `14emu_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/14emu/14emu_normal/14emu_normal.model3.json` | 通过 | `Wonderlands x Showtime` 基础角色 |
| 宵崎奏 `17kanade_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/17kanade/17kanade_normal/17kanade_normal.model3.json` | 通过 | `25 时，Nightcord 见` 核心角色 |

### 13.7 JS 加载写法

补充一条这轮复验里非常重要的兼容性结论：

1. 在当前 Chrome 108 验证环境下，`PIXI 7.x` 直连 `pixi-live2d-display 0.4.0` 会踩到 `PIXI.utils.EventEmitter` 兼容问题。
2. 这一轮真正稳定跑通的脚本组合是：
   - `https://pixijs.download/v6.5.10/pixi-legacy.min.js`
   - `https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js`
   - 对应的 Cubism core
   - 对应的 `cubism2.min.js` / `cubism4.min.js`
3. 后面如果继续扩表，建议直接沿用这组组合，不要再回退到旧的 `PIXI 7.3.2` 样例写法。

如果你把这些模型下载到自己站点，例如放到：

- `/public/live2d/lafei/lafei.model3.json`
- `/public/live2d/senko/senko.model3.json`

那么挂载代码就是：

```html
<canvas id="view" width="420" height="520"></canvas>
<script src="https://pixijs.download/v6.5.10/pixi-legacy.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js"></script>
<script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism4.min.js"></script>
<script>
  (async () => {
    const app = new PIXI.Application({
      view: document.getElementById("view"),
      width: 420,
      height: 520,
      backgroundAlpha: 0,
    });

    const model = await PIXI.live2d.Live2DModel.from("/live2d/lafei/lafei.model3.json", {
      autoUpdate: true,
      motionPreload: PIXI.live2d.MotionPreloadStrategy.NONE,
    });

    model.anchor.set(0.5, 1);
    model.scale.set(0.18);
    model.x = app.screen.width * 0.5;
    model.y = app.screen.height;

    app.stage.addChild(model);
  })();
</script>
```

如果是 Cubism 2.1 旧模型，例如 `少女前线`、`海王星`、`Miku` 或 `崩坏学园 2` 这一组，则把运行时换成：

```html
<script src="https://pixijs.download/v6.5.10/pixi-legacy.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism2.min.js"></script>
```

其余调用方式不变，只是 manifest 改成 `.model.json`。

## 14. 明确不能直接用的资源

### 14.1 `diannaojiang/bandream_l2d`

这条线本轮可以明确写成：

1. 角色 IP 很有价值，都是 `BanG Dream!` 常见角色。
2. 但当前仓库下载后不能直接给 `pixi-live2d-display`。
3. 失败集中且一致，不是偶发网络问题，而是 manifest 里的贴图路径与仓库实际文件布局不一致。

本轮抽测结果：

| 条目 | Runtime | 下载后本地直挂 | 失败信息 |
| --- | --- | --- | --- |
| `kasumi_event053.1024` | Cubism 2.1 | 失败 | `Texture loading error` |
| `tae_event053.1024` | Cubism 2.1 | 失败 | `Texture loading error` |
| `rimi_event053.1024` | Cubism 2.1 | 失败 | `Texture loading error` |
| `saya_event053.1024` | Cubism 2.1 | 失败 | `Texture loading error` |
| `arisa_event053.1024` | Cubism 2.1 | 失败 | `Texture loading error` |
| `kokoro_live_t_shirt_t02.1024` | Cubism 2.1 | 失败 | `Texture loading error` |
| `kaoru_live_t_shirt_t03.1024` | Cubism 2.1 | 失败 | `Texture loading error` |
| `kanon_event011.1024` | Cubism 2.1 | 失败 | `Texture loading error` |
| `misaki_live_t_shirt_t01.1024` | Cubism 2.1 | 失败 | `Texture loading error` |
| `sayo_event010.1024` | Cubism 2.1 | 失败 | `Texture loading error` |

以 `kasumi_event053.1024` 为例，manifest 写的是：

```txt
"textures": [
  "kasumi_event053.1024/texture_00.png"
]
```

但仓库里真正存在的是：

```txt
texture_00.png
```

也就是说：

1. 模型主体 `moc` 和 `model.json` 都在。
2. 但贴图引用路径多了一层并不存在的目录。
3. 至少需要批量改 manifest 或补目录结构，才能变成“下载后可直接挂”的资源池。

所以这条线当前应标成：

- `著名 IP，但当前不能直接挂载`
- `修 manifest / 贴图路径后才值得继续尝试`

### 14.2 `GFL-Live2D-Viewer`

这条线现在可以明确写成：

1. 仓库里确实有大量 `model.json`
2. 但下载后不能直接给 `pixi-live2d-display`
3. 失败不是偶发，而是 manifest 与真实文件名体系不一致

本轮抽测结果：

| 条目 | Runtime | 下载后本地直挂 | 失败信息 |
| --- | --- | --- | --- |
| `hk416sc` | Cubism 2.1 | 失败 | `Network error` |
| `an94sr` | Cubism 2.1 | 失败 | `Network error` |
| `wa2000hc` | Cubism 2.1 | 失败 | `Network error` |
| `welrodlod` | Cubism 2.1 | 失败 | `Network error` |
| `suomimfh` | Cubism 2.1 | 失败 | `Network error` |
| `g41bp2062` | Cubism 2.1 | 失败 | `Network error` |

以 `hk416sc` 为例，manifest 实际写的是：

```txt
"model": "HK416_costume1_live2d_model.moc",
"physics": "HK416_costume1_live2d_physics.json",
{"file":"motions/HK416_costume1_live2d_login.mtn"}
```

但仓库里真正给出的文件却是：

```txt
HK416_costume1_live2d_model.moc.bytes
motions/HK416_costume1_live2d_login.mtn.bytes
```

也就是说：

1. 资源不是没有
2. 但它不是“下载下来即可直接挂”的形态
3. 至少需要改名、改 manifest，甚至批量修补一整套引用

所以这条线当前应标成：

- `下载后不能直接挂载`
- `需要改名 / 修路径后才可能继续尝试`

### 14.3 明日方舟与 PRTS

这条线本轮继续按最高优先级追了一次，但结论仍然没有变成“可直挂 Live2D”：

1. PRTS 上那类“看板娘 / 小人”页面更像 Spine 资源浏览。
2. 本轮新增核对的 `Halyul/aklive2d` 虽然 README 写的是 `Arknights Live2D-equipped operators`，但仓里没有可直接交给 `pixi-live2d-display` 的 `.model3.json/.model.json` manifest。
3. 这仓的实现和配置实际围绕 `spine-webgl`、`spine-ts`、`LICENSE_SPINE` 以及 `use_json` 这条 Spine 展示链路展开，不是当前文档要收的 Live2D runtime 输入。
4. 所以截至本轮，仍然没有确认到公开可直接给 `pixi-live2d-display` 的明日方舟 Live2D manifest 池。
5. 如果目标是“明日方舟那种小人互动效果”，技术路线仍然应该优先看 Spine，不是把 PRTS 小人或 `aklive2d` 这类项目硬塞给 Live2D。

### 14.4 `Blue Archive` 候选仓

这条线本轮也追了两个看起来很像“可用来源”的仓，但结论仍然是否定的：

1. `stories2/BlueArchive` README 明确写着 `Arona live2d model`，但仓里实际只有 `arona.cmo3`、`randomPose.can3`、若干 `psd/gif`。
2. `cmo3` 和 `can3` 属于 Cubism 编辑工程，不是 `pixi-live2d-display` 直接加载的 runtime manifest。
3. `respectZ/blue-archive-viewer` 虽然角色很多，但资源实质是 `.atlas + .skel`，也就是 Spine，不是 Live2D manifest。
4. 所以截至本轮，`Blue Archive` 仍然不能进入“可直接挂载”的 Live2D 模型池。

### 14.5 对后续搜集模型池的实际建议

如果目标是继续“越攒越多”，优先级现在已经很清楚：

1. 先把 `CUE-live2d-Viewer` 和 `AzurLane-Live2D` 这两仓下载后做自己的静态托管。
2. 优先从 `KISGP/model`、`zenghongtu/live2d-model-assets`、`SEKAI-Stories` 这些已经证明确实能产出著名 IP 直挂条目的仓继续扩。
3. 再从 `Eikanya/Live2d-model` 里按角色知名度逐条补测。
4. 对 `GFL-Live2D-Viewer` 和 `bandream_l2d` 这种仓库，不要再当成“直接可挂资源池”，而应当归类为“待修补资源池”。
5. 对 `Blue Archive`、明日方舟（包括 `PRTS`、`Halyul/aklive2d`）这类目前更像 Spine 或只拿到 `cmo3/can3` 的路线，单独走兼容性调研，不要混到 Live2D 直挂表里。

## 15. 参考

1. `pixi-live2d-display` README.zh：<https://github.com/guansss/pixi-live2d-display/blob/master/README.zh.md>
2. `pixi-live2d-display` 仓库：<https://github.com/guansss/pixi-live2d-display>
3. `Live2D/CubismWebSamples`：<https://github.com/Live2D/CubismWebSamples>
4. `Cpk0521/CUE-live2d-Viewer`：<https://github.com/Cpk0521/CUE-live2d-Viewer>
5. `donjuanplatinum/AzurLane-Live2D`：<https://github.com/donjuanplatinum/AzurLane-Live2D>
6. `Eikanya/Live2d-model`：<https://github.com/Eikanya/Live2d-model>
7. `KISGP/model`：<https://github.com/KISGP/model>
8. `zenghongtu/live2d-model-assets`：<https://github.com/zenghongtu/live2d-model-assets>
9. `lezzthanthree/SEKAI-Stories`：<https://github.com/lezzthanthree/SEKAI-Stories>
10. `diannaojiang/bandream_l2d`：<https://github.com/diannaojiang/bandream_l2d>
11. `namv22/GFL-Live2D-Viewer`：<https://github.com/namv22/GFL-Live2D-Viewer>
12. `guansss/live2d-viewer-web`：<https://github.com/guansss/live2d-viewer-web>
13. `PIXI Legacy` 直链：<https://pixijs.download/v6.5.10/pixi-legacy.min.js>
14. `pixi-live2d-display` `index.min.js`：<https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js>
15. Cubism 4 Core 直链：<https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js>
16. Cubism 2 Core 兼容直链参考：<https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js>
17. PRTS 阿米娅 Spine 页面：<https://prts.wiki/w/%E9%98%BF%E7%B1%B3%E5%A8%85/spine>
18. `stories2/BlueArchive`：<https://github.com/stories2/BlueArchive>
19. `respectZ/blue-archive-viewer`：<https://github.com/respectZ/blue-archive-viewer>
20. `Halyul/aklive2d`：<https://github.com/Halyul/aklive2d>
