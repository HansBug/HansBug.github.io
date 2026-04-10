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

| 模型 | 入口格式 | 来源 | 实测状态 | 备注 |
| --- | --- | --- | --- | --- |
| Shizuku | `model.json + moc` | `pixi-live2d-display` 上游测试资源 | 通过 | Cubism 2.1，经典旧格式样例 |
| Haru greeter | `model3.json + moc3` | `pixi-live2d-display` 上游测试资源 | 通过 | 与 README 示例体系高度一致 |
| Hiyori | `model3.json + moc3` | `Live2D/CubismWebSamples` | 通过 | 官方标准样例 |
| Haru | `model3.json + moc3` | `Live2D/CubismWebSamples` | 通过 | 官方标准样例 |
| Mao | `model3.json + moc3` | `Live2D/CubismWebSamples` | 通过 | 官方现代样例 |
| Mark | `model3.json + moc3` | `Live2D/CubismWebSamples` | 通过 | 结构简单，适合调试 |
| Natori | `model3.json + moc3` | `Live2D/CubismWebSamples` | 通过 | 即 Jin Natori 路线资源 |
| Rice | `model3.json + moc3` | `Live2D/CubismWebSamples` | 通过 | 官方进阶样例 |
| Wanko | `model3.json + moc3` | `Live2D/CubismWebSamples` | 通过 | 动物系样例，也可直接挂载 |

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

## 11. 参考

1. `pixi-live2d-display` README.zh：<https://github.com/guansss/pixi-live2d-display/blob/master/README.zh.md>
2. `pixi-live2d-display` 仓库：<https://github.com/guansss/pixi-live2d-display>
3. `Live2D/CubismWebSamples`：<https://github.com/Live2D/CubismWebSamples>
4. `PIXI` CDN：<https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js>
5. Cubism 4 Core 直链：<https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js>
6. Cubism 2 Core 兼容直链参考：<https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js>
7. PRTS 阿米娅 Spine 页面：<https://prts.wiki/w/%E9%98%BF%E7%B1%B3%E5%A8%85/spine>
