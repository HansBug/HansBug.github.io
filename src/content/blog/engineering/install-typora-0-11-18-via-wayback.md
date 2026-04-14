---
title: "旧版不是没了，只是不在台前了——从 Wayback 把 Typora 0.11.18 接回 Ubuntu 24.04"
description: "Typora 还活得很好，只是 old beta 的 Linux 官方下载链路已经退场。本文把 Typora 的现状、Wayback 为什么有必要、以及一条在 Ubuntu 24.04 上跑通的 0.11.18 用户级安装方案一次讲清楚。"
pubDate: 2026-04-13
updatedDate: 2026-04-14
tags:
  - 工程效率
  - 知识管理
  - 调试排障
difficulty: "实践"
excerpt: "这篇文章真正要解决的问题，不是“Typora 收不收费”，而是“今天还怎么把 Typora 0.11.18 这种 old beta 从可信来源接回本地，并顺手把 xdg-open 也接过去”。"
series: "开发环境折腾"
draft: false
pinned: false
---

最近换机器的时候，笔者又被一件老问题追着打了一次：`Typora < 1.0` 到底还能不能装回来？

这事看起来很像一个“网上搜一下就完了”的小问题，真做起来却并不那么体面。官网还在，购买页还在，历史版本入口也还在，甚至 `Old Beta` 的说明页都没消失；可你真要把 Linux 上的 `0.11.18` 原始 `.deb` 包拿回来，链路偏偏就断在最让人烦的地方。说白了，站点没死，按钮先死了。

所以这篇文章不打算只给一条下载命令糊弄过去，而是把事情从头到尾掰开讲清楚。闲话少叙，先把结论拍在桌上：

## 先把结论拍在桌上

如果你只想看最终判断，那么可以先记住下面这几条：

1. **Typora 现在当然还活着，而且已经是正式收费软件了。**
2. **官网今天依然保留着历史版本入口和 `Old Beta / 0.11.18` 的说明，但 Linux `0.11.18` 官方原始下载地址目前返回 `HTTP 404`。**
3. **Wayback Machine 里仍然能拿到当年 `download.typora.io` 的原始官方文件，而且这条链路在 `Ubuntu 24.04` 上实测可用。**
4. **笔者最终采用的是“Wayback 拉包 + 用户级解包 + 本地 wrapper + desktop entry + `xdg-mime` 绑定”的方案，并已把 `xdg-open` 一并接回 Typora。**

本文的信息核对时间是 **2026 年 4 月 13 日**。这种下载链路以后大概率还会继续变化，所以时间点必须先钉住。否则过两年再回来看，很容易把“当时有效”误读成“永远有效”。

## Typora 没失踪，只是早就不是当年的 Typora 了

先把最基础的问题说清楚：**Typora 本质上就是一个 Markdown 编辑器。** 它长期以来最能打的地方，也不是插件商店、知识库体系或者一堆花里胡哨的附加能力，而是那种把写作和预览尽量揉平、把干扰降到最低的体验。Typora 官网首页对它自己的描述也很直白，大意就是一个极简的 Markdown editor and reader，重点在于减少模式切换，把写作动作做顺。（见文末参考资料 1）

这也是为什么它会有一批相当稳定的老用户。你平时未必会天天夸它，但真到了要换编辑器、或者重装机器的那一刻，往往才会意识到，自己的手已经被这套工作流养刁了。

如果你已经很久没打开过 Typora 官网，那么今天看到的首页其实还是那个熟悉的气质：留白很多，界面很轻，安安静静地把“写 Markdown”这件事摆在前面，没有什么刻意吵你的营销堆料。下面这张图，就是 **2026 年 4 月 13 日** 的 Typora 官方首页首屏：

![Typora 官网首页首屏截图（2026-04-13）](/images/posts/install-typora-0-11-18-via-wayback/typora-home-hero.png)

*图 1：Typora 官方首页首屏。来源：Typora 官方首页（参考资料 1），截图时间 2026-04-13。*

至于“这东西到底是谁做的”，公开信息其实能对出两层口径：

- Typora 官网页脚的 `Team` 链接会跳转到 `appmakes.io`，而 Typora 也确实列在这个站点的产品列表里。（见参考资料 1、6）
- 但 Typora 的 `License Agreement` 里，又把 typora.io / Typora 的 developer(s) 更正式地写成了 `Qiyun (Shanghai) Technology Ltd.`。（见参考资料 3）

换句话说，如果按公开产品体系去理解，把它看成 `typora.io / appmakes` 这套品牌链路下的产品，没有问题；如果按协议文本去说，那么开发主体在法律文本里写得更明确。两种说法不是互相打架，而是处在不同层次。

然后就是大家最关心、同时也最容易被传得面目全非的那句话：**是的，Typora 现在已经收费了。**

这件事其实没必要兜圈子。公开信息里至少有三条线可以互相对上：

- 官网购买区直接写着 `15 days free trial` 和价格。（见参考资料 1）
- 购买 FAQ 明确说明它是 **one-time payment**，不是订阅制，而且一个 license 最多可激活 3 台设备。（见参考资料 2）
- `What's New 1.0` 页面把 `Typora finally reaches v1.0` 和 `Purchase / Activate Typora` 并列写在一起，这基本已经把“beta 长跑结束，进入正式商业化阶段”的分界线摆明了。（见参考资料 4）

下面这张图，就是笔者在 **2026 年 4 月 13 日** 从 Typora 官网首页截下来的购买区：

![Typora 官网购买区截图（2026-04-13）](/images/posts/install-typora-0-11-18-via-wayback/typora-home-purchase.png)

*图 2：Typora 官网购买区。可以直接看到 `15 days free trial`、价格和 `All / History Releases` 入口。来源：Typora 官方首页（参考资料 1），截图时间 2026-04-13。*

所以先把这个坐标系钉死：**“Typora 现在收费”** 这件事是真的，而且并不隐晦；但它和 **“我今天还能不能把某个 old beta 包直接从官网官方下载回来”**，压根不是同一个问题。很多讨论之所以越聊越乱，就是因为一上来把这两件事糊成了一锅粥。

## 真正断掉的，不是站点，而是 old beta 的官方下载链

接下来才是这篇文章真正要解决的问题。

很多人第一反应会说，那不就买个新版完事了？理论上当然可以，甚至这是最省心的路径。但现实通常没有这么整齐。有人只是想把旧工作流原样搬回来，有人是在临时机器上补一个熟悉的 Markdown 编辑器，还有人单纯就是对旧 beta 已经用顺手了，不想临时接一套新的授权迁移流程。

更关键的是，**“软件商业化了”** 和 **“旧 beta 包还在不在当前官方下载链上”**，是两个层次完全不同的问题。前者讲产品状态，后者讲分发链路。两件事看起来挨得很近，实则不是一回事。

这里最容易混淆的点，笔者直接列出来：

- 官网并不是彻底没有历史版本入口。首页和购买区今天依然能看到 `All / History Releases`。（见参考资料 1）
- 购买 FAQ 也明确提到，old release builds 可以在对应页面找到。（见参考资料 2）
- 但是像 `0.11.18` 这种 **pre-1.0 的 Linux beta 包**，当前公开页面已经不是“点一下按钮就能把 `.deb` 下回来”的状态了。

换句话说，事情的真实面貌不是“官网只剩 404”，而是更别扭、也更容易让人误判的那一种：

- 官网还在。
- 历史说明还在。
- `Old Beta / 0.11.18` 那段说明也还在。
- 但你真正想要的 Linux 官方原始包，已经不在当前公开下载链路上了。

笔者之所以最后单独写下这篇，正是因为实测时发现，这条链路现在是断了一半，而且断得很有迷惑性：

1. `https://typora.io/releases/dev` 当前仍然保留着 `Old Beta` 和 `0.11.18` 这一段说明。
2. 但在这个页面里，`0.11.18` 目前只剩 release notes，本身并没有像新版那样继续挂出 Linux `.deb` 按钮。
3. 笔者在 **2026 年 4 月 13 日** 直接请求原始地址 `https://download.typora.io/linux/typora_0.11.18_amd64.deb`，返回的是 `HTTP 404`。
4. 同一时间，请求 Wayback 对应的历史快照时，则还能拿到 `HTTP 200` 和完整文件长度。

这也是为什么这篇文章里一定要把 Wayback Machine 拿出来单独说。不是因为它多神秘，而是因为它在这里承担的角色很单纯：**不是拿来替代官方来源，而是把当年的官方原始文件地址从历史归档里重新捞出来。**

而且 Wayback 这里也不是一句空话。你今天真把这个地址喂进去，它会给你一张很直白的时间线，告诉你这个官方 `.deb` 文件被抓取过多少次，大概从什么时候开始进入归档。下面这张图，就是对应归档页在 **2026 年 4 月 13 日** 的样子：

![Wayback 上 Typora 0.11.18 官方 deb 归档页截图（2026-04-13）](/images/posts/install-typora-0-11-18-via-wayback/wayback-typora-package-index.png)

*图 3：Wayback Machine 对 `typora_0.11.18_amd64.deb` 原始官方地址的归档页。来源：Internet Archive Wayback Machine（参考资料 7），截图时间 2026-04-13。*

下面这张图，则是当前 dev release 页面里 `Old Beta / 0.11.18` 那一段：

![Typora dev release 页面 Old Beta 截图（2026-04-13）](/images/posts/install-typora-0-11-18-via-wayback/typora-dev-old-beta.png)

*图 4：Typora 当前 dev release 页面中的 `Old Beta / 0.11.18` 段落。页面保留了旧 beta 的发布说明，但当前公开页面里没有继续给出 Linux 下载按钮。来源：Typora dev release 页面（参考资料 5），截图时间 2026-04-13。*

从协议文本角度看，这种局面其实也不算奇怪。Typora 的 `License Agreement` 明确写过，他们可以在一段时间后，或者在发现 older versions 存在严重问题时，把这些版本从网站上移除。（见参考资料 3）

所以，严格来说，今天这个局面不是“官网没了”，而是：

- 官网还在。
- 历史记录还在。
- 但 `0.11.18` 这种 old beta 的 Linux 原始包，已经不再挂在当前官方下载链路里。

说白了，**站点没有退场，old beta 退场了。** 这两者差别很大。前者意味着产品死亡，后者只是官方分发策略已经把老版本请出了前台。

## 为什么我最后盯上了 0.11.18

既然要从 old beta 里挑一个版本出来，就还得回答另一个非常现实的问题：为什么偏偏是 `0.11.18`？

答案其实相当务实，没有什么玄学成分：

- 它在当前 dev release 页面里依然保留着明确的 `Old Beta` 记录。（见参考资料 5）
- Wayback 里对应的 Linux `amd64 .deb` 快照可以完整取回。
- 下载之后，用 `dpkg-deb -I` 检查时，版本字段明确写的是 `0.11.18-1`。

换句话说，这不是从某个论坛评论区里扒出来的“听说还能用”的神秘安装包，而是当前仍然可以比较稳地建立起证据链的一档版本。工程上很多时候就该这么干，不要用情怀代替校验，更不要拿猜测冒充来源。

先看两条最关键的校验命令：

```bash
curl -I -s https://download.typora.io/linux/typora_0.11.18_amd64.deb | sed -n '1,12p'

curl -I -s \
  'https://web.archive.org/web/20220518163411if_/https://download.typora.io/linux/typora_0.11.18_amd64.deb' \
  | sed -n '1,20p'
```

笔者在 **2026 年 4 月 13 日** 实测时，前者返回 `404`，后者返回 `200`，而且还能看到类似下面这些信息：

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

到这一步，版本基本就定下来了。不是因为它“够老所以浪漫”，而是因为它在今天这个时间点上，仍然能把来源、快照、包体和版本信息串成一条说得清楚的链。

## 正式动手：把 0.11.18 接回 Ubuntu 24.04

好，背景交代完了，现在开始干正事。

这次笔者没有走系统级安装，而是直接做成了 **用户级安装**。原因很简单，而且都很现实：

- 当时机器上没有免密 `sudo`。
- 旧 Electron 包硬塞进系统目录，实际收益并不大。
- 放进 `~/.local` 里，后续迁移、删除和重装都更干净。

说到底，这不是“能不能装”的问题，而是“值不值得为了一个旧 beta 把系统目录搅得乱七八糟”的问题。笔者的答案是否定的。

### 1. 从 Wayback 拉回官方历史包

```bash
mkdir -p ~/.cache/typora-installer

curl -fL \
  'https://web.archive.org/web/20220518163411if_/https://download.typora.io/linux/typora_0.11.18_amd64.deb' \
  -o ~/.cache/typora-installer/typora_0.11.18_amd64.deb
```

这里的 `if_` 不要省。它的作用，是让 Wayback 直接把归档中的原始文件字节吐出来，而不是再套一层网页回放壳。这个细节要是漏了，后面你拿到的很可能就不是你以为的东西。

### 2. 解包到 `~/.local/opt`

```bash
rm -rf ~/.local/opt/typora-0.11.18
mkdir -p ~/.local/opt/typora-0.11.18

dpkg-deb -x \
  ~/.cache/typora-installer/typora_0.11.18_amd64.deb \
  ~/.local/opt/typora-0.11.18
```

解开之后，真正的程序主体在这里：

```text
~/.local/opt/typora-0.11.18/usr/share/typora/Typora
```

### 3. 补一个本地 wrapper

旧 Electron 包放到用户目录后，直接起原始二进制，体验未必舒服。笔者这次实际跑通的方式，是补一个很薄的 wrapper，并且显式带上 `--no-sandbox`：

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

包里原始的 `typora.desktop` 还是系统级安装假设下的写法。既然现在走的是用户级安装，那最好老老实实自己写一份绝对路径版本，别和系统默认逻辑打架。

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

因为很多时候，你真正想要的并不是“程序能启动”，而是“以后双击 `.md` 文件也好，执行 `xdg-open README.md` 也好，都别再把我送去别的编辑器了”。装好了却接不过默认打开链路，那体验和半残其实也差不了太多。

先看系统当前把 `.md` 识别成什么 MIME：

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

到这里，`xdg-open` 这一层就算一起收好了。别的不说，至少“我双击一个 Markdown 文件，结果桌面环境把我扔去别的程序”这种闹心事，应该可以一并解决。

## 验收别只盯着 `--version`，要看它有没有真的活过来

对这种旧 Electron 程序来说，`typora --version` 并不是一个总能让人舒服的测试方式。

它有时会顺手把整套进程拉起来，还可能夹着 `libva`、IBUS 或 GPU 相关警告一起冒出来。单看那几行输出，很容易让人误以为“这玩意是不是已经炸了”。很多时候问题不在程序真挂了，而在于测试动作本身就挑得不够好。

所以笔者更建议这么确认：

```bash
pgrep -af "${HOME}/.local/opt/typora-0.11.18/usr/share/typora/Typora"
ls -1 ~/.config/Typora | sed -n '1,40p'
```

这次实际验收时，可以看到：

- `Typora --no-sandbox` 相关进程已经起来了。
- `~/.config/Typora` 已经生成了配置目录。
- 配置里记录的 `appVersion` 是 `0.11.18`。

换句话说，它不是停留在“文件成功解包”的阶段，而是真的已经跑起来过了。这两者差别不小。前者只能证明你会复制文件，后者才说明这条链路在桌面环境里至少是活的。

## 收个尾：Wayback 不是野路子，没证据链才是

写到这里，这件事的主线其实已经很清楚了。

Typora 并不是“突然消失”的软件。到 **2026 年 4 月 13 日** 为止，它官网、购买页、支持页和历史版本入口都还在，产品本身也活得好好的；只是它早就走过了 beta 阶段，进入了正式收费版本，而像 `0.11.18` 这种 old beta 的 Linux 原始包，也已经不再挂在当前官方下载链路里了。

所以这次借 Wayback，重点从来都不是“找一个神秘镜像凑合下载”，而是把 **当年 Typora 官方 `download.typora.io` 上的原始文件** 从归档里重新捞出来。两者看起来都叫“下载旧版本”，本质上却完全不是一个路数。前者是碰运气，后者是尽量把来源钉实。

当然，边界也得说清楚，不能因为装上了就开始自我感动：

- 这是 `2021` 年的旧 beta。
- `--no-sandbox` 是个实用但并不优雅的兼容性做法。
- 如果未来系统继续升级，旧 Electron 仍然可能再冒出新的桌面兼容问题。

不过，如果你的目标只是很朴素的那一个：**在今天这台 Ubuntu 机器上，把一个还能写 Markdown、还能接管 `xdg-open` 的 Typora old beta 装回来**，那么 `0.11.18 + Wayback + 用户级安装` 这条链路，至少在本文核对时间点上，确实是能走通的。

说到底，这篇文章真正想钉住的并不是“某个软件旧版本还能不能装”这么简单，而是另一层更常见、也更容易被忽视的工程判断：**能跑不等于链路成立，下载到文件也不等于来源可信。** 把来源、页面、快照、包体、启动方式和桌面关联一路串起来，这事才算真正说清楚。否则很多所谓“解决方案”，不过是把问题从一个角落踢到另一个角落罢了。

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
