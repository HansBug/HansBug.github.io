---
title: "Typora 早就收费了，那旧版去哪找？一次把 0.11.18、Wayback 和 xdg-open 讲清楚"
description: "先把 Typora 是什么、现在为什么收费、旧 beta 为什么难找这几件事说清楚，再用一条已经在 Ubuntu 24.04 上跑通的链路，把 0.11.18 和 xdg-open 一起接回本地。"
pubDate: 2026-04-13
updatedDate: 2026-04-13
tags:
  - 工程效率
  - 知识管理
  - 调试排障
difficulty: "实践"
excerpt: "官网还在，历史版本入口也还在，但 `0.11.18` 这种 pre-1.0 Linux beta 现在已经不是点一下就能下回来的状态了。本文把背景、来源、实操和参考资料一次整理清楚。"
series: "开发环境折腾"
draft: false
pinned: false
---

如果你从很多年前就开始用 Typora，大概率会对它有种特别的熟悉感。

不是那种”功能特别多”的熟悉，而是另一种更微妙的熟悉：它一直很安静，打开就写，写的时候不拧巴，不像在和一堆按钮较劲。也正因为如此，很多人从它还在 beta 时代就开始用，一路用到了现在。

问题也就从这里开始了。

当你某天换了机器，想把 `Typora < 1.0` 再装回来时，会发现事情已经不是当年那样了。官网当然还在，支持页也在，购买页也在，历史版本入口甚至也还留着；但等你真想把 Linux 上的 `0.11.18` 这种老 beta 包拿回来，链路就突然不顺了。

所以这篇文章不只是“教你下一个旧包”。

更准确地说，本文想做三件事：

1. 先把 Typora 现在到底是个什么状态讲清楚。
2. 再把为什么还要借 Wayback 这件事讲清楚。
3. 最后给出一条已经在 `Ubuntu 24.04` 上实际跑通的安装方式，并把 `xdg-open` 一起接到 Typora 上。

本文的信息核对时间是 **2026 年 4 月 13 日**。这类下载链路以后可能还会变，所以时间点先说在前面。

## 先把 Typora 这件事说清楚

先说最基本的：**Typora 本身就是一个 Markdown 编辑器**，而且它官方一直强调的卖点并不是”插件生态”或者”知识库系统”，而是那种尽量把写作动作做平的体验。官网首页对它的介绍很直白，大意就是一个极简的 Markdown editor and reader，核心体验是把预览和写作尽量揉在一起，减少模式切换和干扰。（见文末参考资料 1）

这也是为什么它会有一批很稳定的老用户。你不一定天天夸它，但真要换掉的时候，往往会突然意识到，哦，原来自己已经被这种工作流养叼了。

如果你已经很久没打开过它的官网，今天的首页其实还是那个熟悉的味道：很白，很轻，很安静，几乎没有故意吵你的营销堆砌。下面这张图，就是 **2026 年 4 月 13 日** 的 Typora 官方首页首屏：

![Typora 官网首页首屏截图（2026-04-13）](/images/posts/install-typora-0-11-18-via-wayback/typora-home-hero.png)

*图 1：Typora 官方首页首屏。来源：Typora 官方首页（参考资料 1），截图时间 2026-04-13。*

至于“这东西是谁做的”，公开信息里能看到两层：

- Typora 官网页脚的 `Team` 链接会跳到 `appmakes.io`，Typora 也确实在这个站点的产品列表里。（见参考资料 1、6）
- 而 Typora 的 `License Agreement` 里，则把 typora.io / Typora 的 developer(s) 明确写成了 `Qiyun (Shanghai) Technology Ltd.`。（见参考资料 3）

也就是说，如果只按官网产品层来讲，可以把它理解成 `typora.io / appmakes` 这套公开品牌体系下的产品；如果按法律和协议文本来讲，开发主体在协议里写得更正式。

接下来就要说到大家最关心的那句了：**是的，Typora 现在已经是收费软件了。**

这一点其实没什么好绕的。公开材料里至少有三条线都能互相对上：

- 官网购买区已经直接写了 `15 days free trial` 和价格。（见参考资料 1）
- 购买 FAQ 里明确写了它是 **one-time payment**，不是订阅，而且一个 license 最多可激活 3 台设备。（见参考资料 2）
- `What's New 1.0` 页面则把 `Typora finally reaches v1.0` 和 `Purchase / Activate Typora` 写在了一起，这基本就是“从 beta 长跑切到正式商业化阶段”的公开分界线。（见参考资料 4）

下面这张图就是我在 **2026 年 4 月 13 日** 从 Typora 官网首页截下来的购买区：

![Typora 官网购买区截图（2026-04-13）](/images/posts/install-typora-0-11-18-via-wayback/typora-home-purchase.png)

*图 2：Typora 官网购买区。可以直接看到 `15 days free trial`、价格和 `All / History Releases` 入口。来源：Typora 官方首页（参考资料 1），截图时间 2026-04-13。*

## 那为什么还要折腾旧版

说到这里，很多人的第一反应大概是：那不就买个新版完事了？

理论上当然可以。

但现实往往没那么整齐。有人就是想把老工作流原样搬回来，有人只是临时在一台机器上补个熟悉的 Markdown 编辑器，还有人单纯是因为旧 beta 用习惯了，懒得折腾新的授权和迁移。

而且更关键的是，**”Typora 现在收费”** 和 **”我现在还能不能从官网直接拿回 old beta 安装包”**，其实是两件不同的事。

这里最容易混淆的点，我先直接讲清楚：

- 官网并不是完全没有历史版本入口。首页和购买区现在仍然能看到 `All / History Releases`。（见参考资料 1）
- 购买 FAQ 里也明确说了 old release builds 可以在对应页面找到。（见参考资料 2）
- 但是，像 `0.11.18` 这种 **pre-1.0 的 Linux beta 包**，当前公开页面里已经不是“点按钮直接下载”的状态了。

换句话说，事情不是“官网只剩下一张 404 了”。主页还在，release 页面也还在，而且 release 页面本身还保留着一长串当前 dev 版和历史记录。只是等你一路翻到 `Old Beta / 0.11.18` 这一段时，会发现它现在更像是一个历史说明，而不是还在继续维护下载按钮的页面。

我之所以要单独写这篇，正是因为我在实际检查时发现，**这条链路现在是断了一半的**：

1. `https://typora.io/releases/dev` 当前仍然保留着 `Old Beta` 和 `0.11.18` 这一段说明。
2. 但这个页面下，`0.11.18` 只剩 release notes，本身并没有像新版那样继续放 Linux `.deb` 按钮。
3. 我在 **2026 年 4 月 13 日** 直接请求原始地址 `https://download.typora.io/linux/typora_0.11.18_amd64.deb`，返回的是 `HTTP 404`。
4. 同一时间，请求 Wayback 对应的历史快照时，则还能拿到 `HTTP 200` 和完整文件长度。

这也是为什么需要 Internet Archive Wayback Machine。

而且 Wayback 这边也不是个抽象概念。你今天真的把原始地址喂进去，它会给你一张很直白的时间线：这个官方 `.deb` 文件在归档里被抓到过多少次，大概是从什么时候开始被保存下来的。下面这张图，就是对应归档页在 **2026 年 4 月 13 日** 的样子：

![Wayback 上 Typora 0.11.18 官方 deb 归档页截图（2026-04-13）](/images/posts/install-typora-0-11-18-via-wayback/wayback-typora-package-index.png)

*图 3：Wayback Machine 对 `typora_0.11.18_amd64.deb` 原始官方地址的归档页。来源：Internet Archive Wayback Machine（参考资料 7），截图时间 2026-04-13。*

下面这张图，是当前 dev release 页面里 `Old Beta / 0.11.18` 那一段的截图：

![Typora dev release 页面 Old Beta 截图（2026-04-13）](/images/posts/install-typora-0-11-18-via-wayback/typora-dev-old-beta.png)

*图 4：Typora 当前 dev release 页面中的 `Old Beta / 0.11.18` 段落。页面保留了旧 beta 的发布说明，但当前公开页面里没有继续给出 Linux 下载按钮。来源：Typora dev release 页面（参考资料 5），截图时间 2026-04-13。*

从协议文本上看，这件事其实也不奇怪。Typora 的 `License Agreement` 里明确写过，他们可以在一段时间后，或者发现严重问题时，把 older versions 从网站上移除。（见参考资料 3）

所以严格来说，今天这个局面不是“官网没了”，而是：

- 官网还在
- 历史说明还在
- 但 `0.11.18` 这种 old beta 原始 Linux 包已经不再挂在当前官方下载链路上

这时候，Wayback 的作用就很纯粹了：**不是替代官方来源，而是把当年的官方原始文件地址从归档里重新捞出来。**

## 为什么我最后选了 0.11.18

既然要捞 old beta，就还有个问题：为什么偏偏是 `0.11.18`？

答案其实很务实，不玄学：

- 它在当前 dev release 页面里仍然有明确的 `Old Beta` 记录。（见参考资料 5）
- Wayback 里对应的 Linux `amd64 .deb` 快照是完整可取的。
- 下载下来后，用 `dpkg-deb -I` 检查，版本信息明确写的是 `0.11.18-1`。

也就是说，这不是拍脑袋从某个论坛帖子里抄来的”听说还能用的版本”，而是当前还能比较稳地建立起证据链的一档版本。

先看两条最关键的校验命令：

```bash
curl -I -s https://download.typora.io/linux/typora_0.11.18_amd64.deb | sed -n '1,12p'

curl -I -s \
  'https://web.archive.org/web/20220518163411if_/https://download.typora.io/linux/typora_0.11.18_amd64.deb' \
  | sed -n '1,20p'
```

我在 2026 年 4 月 13 日实测时，前者返回 `404`，后者返回 `200`，而且还能看到类似下面这些信息：

- `content-length: 70282052`
- `x-archive-orig-last-modified: Sun, 21 Nov 2021 ...`
- `link: <https://download.typora.io/linux/typora_0.11.18_amd64.deb>; rel="original"`

接着再看包本身：

```bash
dpkg-deb -I ~/.cache/typora-installer/typora_0.11.18_amd64.deb | sed -n '1,40p'
```

能看到：

```text
Package: typora
Version: 0.11.18-1
Architecture: amd64
Homepage: http://typora.io
```

到这一步，版本就基本定下来了。

## 正式动手：把 0.11.18 接回 Ubuntu 24.04

好了，背景说够了，现在开始干正事。

这次我没有走系统级安装，而是直接做成了 **用户级安装**。原因很简单：

- 当时机器上没有免密 `sudo`
- 旧 Electron 包放进系统目录没有太大必要
- 放在 `~/.local` 里，后续迁移、删除、重装都更干净

### 1. 从 Wayback 拉回官方历史包

```bash
mkdir -p ~/.cache/typora-installer

curl -fL \
  'https://web.archive.org/web/20220518163411if_/https://download.typora.io/linux/typora_0.11.18_amd64.deb' \
  -o ~/.cache/typora-installer/typora_0.11.18_amd64.deb
```

这里的 `if_` 别省，它的作用是直接返回归档里的原始文件字节，而不是 Wayback 的页面回放层。

### 2. 解包到 `~/.local/opt`

```bash
rm -rf ~/.local/opt/typora-0.11.18
mkdir -p ~/.local/opt/typora-0.11.18

dpkg-deb -x \
  ~/.cache/typora-installer/typora_0.11.18_amd64.deb \
  ~/.local/opt/typora-0.11.18
```

解开以后，真正的程序主体在这里：

```text
~/.local/opt/typora-0.11.18/usr/share/typora/Typora
```

### 3. 补一个本地 wrapper

旧 Electron 包放在用户目录下时，直接起原始二进制不一定舒服。我这次实际跑通的方式，是补个很薄的 wrapper，并且显式带上 `--no-sandbox`。

```bash
cat > ~/.local/bin/typora <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

app_root="${HOME}/.local/opt/typora-0.11.18/usr/share/typora"

if [[ ! -x "${app_root}/Typora" ]]; then
  echo "Typora 0.11.18 is not installed under ${app_root}" >&2
  exit 1
fi

exec "${app_root}/Typora" --no-sandbox "$@"
EOF

chmod +x ~/.local/bin/typora
```

做到这里以后，终端里就可以直接敲：

```bash
typora
```

### 4. 再补一个桌面启动项

包里原始的 `typora.desktop` 还是系统级安装假设下的写法，用户级安装最好自己写一份绝对路径版本。

```bash
cat > ~/.local/share/applications/typora.desktop <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Typora
Comment=Typora 0.11.18 user-local install
GenericName=Markdown Editor
Exec=${HOME}/.local/bin/typora %U
TryExec=${HOME}/.local/bin/typora
Icon=${HOME}/.local/opt/typora-0.11.18/usr/share/icons/hicolor/256x256/apps/typora.png
Terminal=false
StartupNotify=true
StartupWMClass=Typora
Categories=Office;WordProcessor;
MimeType=text/markdown;text/x-markdown;
EOF
```

然后做一次校验和刷新：

```bash
desktop-file-validate ~/.local/share/applications/typora.desktop
update-desktop-database ~/.local/share/applications 2>/dev/null || true
```

### 5. 把 `xdg-open` 也一起接过来

这一步很重要。

因为很多时候你真正想要的不是”程序装上了”，而是”以后双击 `.md` 文件、或者 `xdg-open README.md`，都别再跑去别的编辑器里了”。

先看系统把 `.md` 识别成什么 MIME：

```bash
tmp_md=$(mktemp --suffix=.md)
printf '# test\n' > "$tmp_md"
xdg-mime query filetype "$tmp_md"
rm -f "$tmp_md"
```

这次实际返回的是：

```text
text/markdown
```

然后把常见的 Markdown MIME 都显式绑给 `typora.desktop`：

```bash
xdg-mime default typora.desktop text/markdown text/x-markdown application/x-markdown
```

可以再查一遍：

```bash
xdg-mime query default text/markdown
xdg-mime query default text/x-markdown
xdg-mime query default application/x-markdown
```

正常的话会看到：

```text
typora.desktop
typora.desktop
typora.desktop
```

而 `~/.config/mimeapps.list` 里也会出现类似内容：

```ini
[Default Applications]
text/markdown=typora.desktop
text/x-markdown=typora.desktop
application/x-markdown=typora.desktop
```

到这里，`xdg-open` 这一层就算是一起收好了。

## 怎么确认它真的能用

对这种旧 Electron 程序，`typora --version` 不是个总能让人舒服的测试方式。

它有时会顺手把整套进程拉起来，还可能夹着 `libva`、IBUS 或 GPU 相关警告一起出现。单看那几行输出，容易让人误以为”这玩意是不是挂了”。

所以我更建议这么确认：

```bash
pgrep -af "${HOME}/.local/opt/typora-0.11.18/usr/share/typora/Typora"
ls -1 ~/.config/Typora | sed -n '1,40p'
```

这次实际验收时，可以看到：

- `Typora --no-sandbox` 相关进程已经起来了
- `~/.config/Typora` 已经生成了配置目录
- 配置里记录的 `appVersion` 是 `0.11.18`

换句话说，它不是停留在“文件成功解包”的阶段，而是真的已经跑起来过了。

## 最后收个尾

写到这里，其实这件事的脉络已经很清楚了。

Typora 不是”突然消失”的软件，它今天依然活得好好的，官网、购买页、支持页、历史版本入口都还在；只是它已经走过了 beta 阶段，进入了正式收费版本，而像 `0.11.18` 这种 old beta 的 Linux 原始包，也已经不再挂在当前官方下载链路里了。

所以这次借 Wayback，不是为了找什么来路不明的镜像，而是为了把 **当年 Typora 官方 `download.typora.io` 上的原始文件** 从归档里重新捞回来。

这条路能用，但也要把边界说清楚：

- 这是 `2021` 年的旧 beta。
- `--no-sandbox` 是个实用但不那么优雅的兼容性做法。
- 如果未来系统继续升级，旧 Electron 仍然可能再冒出新的桌面兼容问题。

不过如果你的目标只是很朴素的那一个：**在今天这台 Ubuntu 机器上，把一个还能写 Markdown、还能接管 `xdg-open` 的 Typora old beta 装回来**，那么 `0.11.18 + Wayback + 用户级安装` 这条链路，确实是能走通的。

## 参考资料

1. Typora 官方首页：<https://typora.io/>，访问时间：2026-04-13。
2. Typora Purchase FAQ：<https://support.typora.io/purchase/>，访问时间：2026-04-13。
3. Typora License Agreement：<https://support.typora.io/License-Agreement/>，访问时间：2026-04-13。
4. Typora What's New 1.0：<https://support.typora.io/What%27s-New-1.0/>，访问时间：2026-04-13。
5. Typora Dev Release Channel：<https://typora.io/releases/dev>，访问时间：2026-04-13。
6. Appmakes 团队页：<https://appmakes.io/>，访问时间：2026-04-13。
7. Internet Archive Wayback Machine 页面：<https://web.archive.org/web/*/https://download.typora.io/linux/typora_0.11.18_amd64.deb>，访问时间：2026-04-13。
8. Typora 旧版 Linux 包原始地址：<https://download.typora.io/linux/typora_0.11.18_amd64.deb>，访问时间：2026-04-13。
9. Typora 旧版 Linux 包 Wayback 原始快照：<https://web.archive.org/web/20220518163411if_/https://download.typora.io/linux/typora_0.11.18_amd64.deb>，访问时间：2026-04-13。
