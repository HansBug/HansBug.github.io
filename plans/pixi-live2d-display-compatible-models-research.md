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
<script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js"></script>
${runtime === "cubism2" ? cubism2Scripts : cubism4Scripts}
<script>
window.addEventListener("error", (event) => {
  window.__result = { ok: false, stage: "window-error", error: event.message };
});

(async () => {
  try {
    window.PIXI = PIXI;
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
<script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js"></script>
<script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism4.min.js"></script>
<script>
  window.PIXI = PIXI;

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
<script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism2.min.js"></script>
<script>
  window.PIXI = PIXI;

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

## 9. 本轮已识别但未进入“已实测可用”名单的知名角色

这些角色在 Live2D 官方 sample 生态里是明确存在的，但本轮文档只把“已经拿到 manifest 直链并真实跑通”的条目列入可用名单，所以它们先单独放在待验证池里。

| 角色 | 当前状态 | 说明 |
| --- | --- | --- |
| Hatsune Miku | 待验证 | 官方 sample 生态里可见，但本轮没有把其 runtime manifest 直链纳入已测矩阵 |
| Unity-chan | 待验证 | 官方 sample 生态里可见，但本轮没有把其 runtime manifest 直链纳入已测矩阵 |
| Chitose | 待验证 | 官方旧样例角色，本轮未纳入已测矩阵 |
| Epsilon | 待验证 | 官方旧样例角色，本轮未纳入已测矩阵 |
| Hibiki | 待验证 | 官方旧样例角色，本轮未纳入已测矩阵 |
| Koharu & Haruto | 待验证 | 官方旧样例组合角色，本轮未纳入已测矩阵 |

后续如果你想优先扩“耳熟能详的角色”，推荐先从 `Hatsune Miku` 和 `Unity-chan` 下手，但仍然要先拿到可直接测试的 `model3.json` / `model.json` 入口。

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
| `donjuanplatinum/AzurLane-Live2D` | `193` | `193 / 193` 通过 | 抽测 `1 / 4` 通过 | 技术上完全可用，远程直挂稳定性一般 |
| `Eikanya/Live2d-model` | 本轮只抽测 8 个代表条目 | `8 / 8` 通过 | 未系统补测 | 可以视为公开 Live2D 聚合仓，但必须逐条复验 |
| `namv22/GFL-Live2D-Viewer` | `86` 个 manifest 存在 | 抽测 `0 / 6` 通过 | 此前远程抽测 `0 / 4` 通过 | 下载后不能直接挂，manifest 与实际文件名不匹配 |
| PRTS 明日方舟小人页 | 不是 Live2D manifest | 不适用 | 不适用 | 这条线仍然是 Spine，不属于 `pixi-live2d-display` 直挂输入 |

### 12.2 这轮最重要的新发现

如果只按“技术上能否直接给 `pixi-live2d-display`”这个标准，这一轮真正值得记住的是：

1. `CUE-live2d-Viewer`：整仓 `195` 个 `model3.json` 本地全过。
2. `AzurLane-Live2D`：整仓 `193` 个 `model3.json` 本地全过。
3. `Eikanya/Live2d-model`：至少能稳定提供更多公开可下载的 Live2D 模型目录，适合继续向外扩。
4. `GFL-Live2D-Viewer`：资源虽然很多，但下载后不是“直接可挂”的形态。

这意味着后面真要持续攒模型池，可以优先盯住：

1. 官方 sample
2. `CUE-live2d-Viewer`
3. `AzurLane-Live2D`
4. `Eikanya/Live2d-model`

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

### 13.4 JS 加载写法

如果你把这些模型下载到自己站点，例如放到：

- `/public/live2d/lafei/lafei.model3.json`
- `/public/live2d/senko/senko.model3.json`

那么挂载代码就是：

```html
<canvas id="view" width="420" height="520"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js"></script>
<script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism4.min.js"></script>
<script>
  window.PIXI = PIXI;

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

如果是 Cubism 2.1 旧模型，例如 `BanG Dream!` 这一组，则把运行时换成：

```html
<script src="https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism2.min.js"></script>
```

其余调用方式不变，只是 manifest 改成 `.model.json`。

## 14. 明确不能直接用的资源

### 14.1 `GFL-Live2D-Viewer`

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

### 14.2 明日方舟与 PRTS

这条线依然没有变化：

1. PRTS 上那类“看伴娘 / 小人”页面更像 Spine 资源浏览。
2. 本轮没有确认到公开可直接给 `pixi-live2d-display` 的明日方舟 Live2D manifest 池。
3. 所以如果目标是“明日方舟那种小人互动效果”，技术路线仍然应该优先看 Spine，不是把 PRTS 小人硬塞给 Live2D。

### 14.3 对后续搜集模型池的实际建议

如果目标是继续“越攒越多”，优先级现在已经很清楚：

1. 先把 `CUE-live2d-Viewer` 和 `AzurLane-Live2D` 这两仓下载后做自己的静态托管。
2. 再从 `Eikanya/Live2d-model` 里按角色知名度逐条补测。
3. 对 `GFL-Live2D-Viewer` 这种仓库，不要再当成“直接可挂资源池”，而应当归类为“待修补资源池”。
4. 对明日方舟，单独走 Spine 调研，不要混到 Live2D 兼容表里。

## 15. 参考

1. `pixi-live2d-display` README.zh：<https://github.com/guansss/pixi-live2d-display/blob/master/README.zh.md>
2. `pixi-live2d-display` 仓库：<https://github.com/guansss/pixi-live2d-display>
3. `Live2D/CubismWebSamples`：<https://github.com/Live2D/CubismWebSamples>
4. `Cpk0521/CUE-live2d-Viewer`：<https://github.com/Cpk0521/CUE-live2d-Viewer>
5. `donjuanplatinum/AzurLane-Live2D`：<https://github.com/donjuanplatinum/AzurLane-Live2D>
6. `Eikanya/Live2d-model`：<https://github.com/Eikanya/Live2d-model>
7. `namv22/GFL-Live2D-Viewer`：<https://github.com/namv22/GFL-Live2D-Viewer>
8. `guansss/live2d-viewer-web`：<https://github.com/guansss/live2d-viewer-web>
9. `PIXI` CDN：<https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js>
10. Cubism 4 Core 直链：<https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js>
11. Cubism 2 Core 兼容直链参考：<https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js>
12. PRTS 阿米娅 Spine 页面：<https://prts.wiki/w/%E9%98%BF%E7%B1%B3%E5%A8%85/spine>
