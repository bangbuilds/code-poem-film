# code-poem-film

一个 Agent Skill（在 [Claude Code](https://claude.com/claude-code) 上做的、测的）：说一首诗或一阕词，做出一条 20–80 秒的**水墨手绘风 2D 动画**。

一个红点落在宣纸上、长出眼睛，把这首诗走一遍；每句诗在题签上随朗诵写出来；最后一句红点自己提笔写，念到哪个字写到哪个字，然后落成一枚红印章。画面每一帧都是代码画的，配乐和音效用 numpy 合成。**不用一张图片、一段视频素材、一首现成的曲子。**

| 《早发白帝城》25.5 秒 | 《念奴娇·赤壁怀古》72 秒 |
|---|---|
| ![早发白帝城的封面](examples/qingzhou/cover.jpg) | ![赤壁怀古的封面](examples/chibi/cover.jpg) |

上面是两条范例成片的第一帧（封面）。画法库里现成的东西见 [kit-1](references/kit-1.jpg)、[kit-2](references/kit-2.jpg)、[kit-3](references/kit-3.jpg)、[kit-4](references/kit-4.jpg)。

同一作者的另一个 skill：[code-doc-film](https://github.com/bangbuilds/code-doc-film)（一句话做 3D 纪录短片）。

## 它做什么

你说：「把《静夜思》做成动画」。助手会：

1. 和你确认题材（没指定诗就给几个候选）、要不要朗诵
2. 先不花钱空跑一遍，把每句诗的画面和红点的戏排出来
3. 配朗诵：短诗整首合成一次、长篇逐句合成，按句切开对到画面上；多音字用同音字替换来保证读音
4. 编配乐和音效，人声出现时自动把音乐压下去
5. 抓帧自查（红点在不在画面里、有没有白帧、哪一帧报错……），渲染出片
6. 交给你：成片、上传版（短片压到 10 MB 以内，长片另出一个 720p 小版）、封面、每秒一帧的总览图，以及带实测数字的帖子草稿

两条范例：

- 《早发白帝城》（七绝，25.5 秒）：这个 skill 就是从它拆出来的。当时从零做，第一版 55 分钟，加朗诵和封面又 29 分钟。
- 《念奴娇·赤壁怀古》（词，一百字，72 秒）：用这个 skill 做的第一条。从提出到成片 63 分钟，其中现画了 14 样库里没有的东西（人物、战船、火、巨浪、石峰、残垒……），都已收进画法库。

## 安装

需要：

- Claude Code（或其他能加载 `SKILL.md` 格式 skill 的编程助手）
- Node.js 20+（渲染用 [HyperFrames](https://hyperframes.heygen.com)，通过 `npx` 调用）
- Python 3.10+，装好 `numpy` 和 `Pillow`
- `ffmpeg`

```bash
git clone https://github.com/bangbuilds/code-poem-film ~/.claude/skills/code-poem-film
pip install numpy pillow
```

然后直接说：「把《登鹳雀楼》做成动画」。

**Codex 等其他工具**：skill 是通用的 `SKILL.md` 格式，脚本只依赖 Python、Node 和 ffmpeg，装到那个工具读取 skill 的目录即可，例如：

```bash
git clone https://github.com/bangbuilds/code-poem-film ~/.agents/skills/code-poem-film
```

这条路**没有实测过**。`film.py stats`（从会话记录里统计用时和 token）只认 Claude Code 的记录，别的工具用 `film.py log` 记的生产日志。

## 不经过 AI，先手动跑一遍范例

```bash
SK=~/.claude/skills/code-poem-film          # 你克隆到的位置
python3 $SK/scripts/new_project.py qingzhou-demo --example qingzhou
cd qingzhou-demo
python3 tools/film.py voice                 # 朗诵（默认用系统语音），切成标题、作者、四句
python3 tools/film.py build                 # 笔画数据 + 时间表 + 配乐混音
python3 tools/film.py qa                    # 抓帧检查，总览图在 build/qa/
python3 tools/film.py render                # 渲染 + 核对 + 打包，约 1 分钟
```

不想要朗诵，把第一步换成 `python3 tools/film.py voice --dry`。

不带 `--example` 新建的工程里是一条「起步片子」：红点沿着一幅长卷走一遍，每句诗经过一样东西。它对任何一首诗都能直接跑通，用来先看到完整流程，再把画面换成这首诗自己的。

## 朗诵

默认 `"provider": "auto"`：装了 `edge-tts` 就用它，否则在 macOS 上用系统自带的 `say`。系统语音机器味重，够验证流程；要好听的声音，接你自己的语音合成：

- 任意命令行：`"provider": "command", "command": "mytts --out {out} \"{text}\""`
- 或者在 `~/.config/code-poem-film/` 放一个 `tts_<名字>.py`，实现 `synth(text, voice, out_path)`，然后 `"provider": "<名字>"`。云端声音的密钥放在这里，不要放进工程。

每段录音只合成一次并缓存，换画面、改编曲都不用重新合成。范例成片用的是作者自己的一个云端音色；公开的范例默认用系统语音，画面会按实际读出来的长度自动重排，末句的逐字对时退回到平均分。

## 现在的状态（请先看这段）

这是一个**早期版本**，如实说明：

- 到目前做过两条片子（《早发白帝城》《念奴娇·赤壁怀古》），都在同一台机器上（macOS，Apple Silicon）。**Linux、Windows、其他编程助手都没有测过**。
- 回归测试（每次改引擎后重跑）：只用 skill 里的文件重新生成《早发白帝城》，和原片对比——抽 13 帧，12 帧逐像素相同，封面 1 帧相差 1 个色阶；声音逐采样相同。
- 「换一首诗要多久」目前只有一个实测数字：《赤壁怀古》63 分钟（72 秒的片子，片长是第一条的 2.8 倍，画面全是新的）。短诗、库里东西够用的情况没有测过，应该更快，但没有数字。
- 发布后做过一次干净安装测试：从 GitHub 克隆，不带作者的任何私有配置，照上面「手动跑一遍范例」的命令用系统语音把《早发白帝城》完整做了出来（24.6 秒，739 帧，渲染 36 秒，自检 0 个问题）。
- 起步片子用另一首诗（《登鹳雀楼》）加系统语音完整跑通过一遍：检查、抓帧、混音、渲染、核对、打包。
- 公开安装的路径（不带作者的私有配置、用系统语音）两条范例都跑通过配音、混音和抓帧检查；用系统语音时《赤壁怀古》有几句会被自检标成「人声被盖住」（编曲是按作者的音色调的），按 `references/audio.md` 调低那几句底下的效果即可。
- 配音：系统语音 `say`、自定义插件两条实测过（整首合成和逐句合成都测过）；`edge-tts` 和 `command` **没有**实测过。
- **声音没有机器能验证**。脚本只量响度、频段、人声比配乐高多少；好不好听、有没有感情，要人来听。
- 只做横版 16:9。竖版要重排版式，没做。
- 人物只有没有脸的远景剪影（文士、武将、仕女），能站、抬手、挥扇，做不了表演。主角永远是红点。
- 末句「边念边写」的逐字时间要对着频谱图手标，没有自动对齐。
- 生僻字可能没有笔画数据（脚本会报出来）。

## 目录

```
SKILL.md                 助手读的入口：流程、规矩
references/              详细文档：poem.json 和时间表、画场景、红点怎么演、声音、检查、交付；kit-*.jpg 是画法库的样子
scripts/new_project.py   新建工程 / 升级已有工程的引擎
template/engine/         引擎：画笔和笔画书写、山水画法、角色、舞台（封面、题签、末句书写、印章）
template/tools/          film.py（唯一入口）、synth.py（乐器和混音）
template/film/           起步片子：时间表、场景、编曲
examples/qingzhou/       完整范例《早发白帝城》（绝句，25.5 秒）
examples/chibi/          完整范例《念奴娇·赤壁怀古》（词，72 秒）
examples/gallery/        画法库图鉴（references/kit-*.jpg 就是它渲出来的）
```

一条片子 = `poem.json`（字）+ `film/timing.js`（什么时候）+ `film/scenes.js`（画什么）+ `film/score.py`（响什么）。朗诵的时刻、题签、末句书写、总时长都按配音的实际长度推算，所以换音色、改语速不用重排。

## 数据与署名

- 汉字笔画：[hanzi-writer-data](https://github.com/chanind/hanzi-writer-data)，来自 [Make Me a Hanzi](https://github.com/skishore/makemeahanzi)，字形源自文鼎公众授权字体（Arphic Public License）。新建工程时通过 npm 安装，授权文本会复制到工程的 `assets/` 里。
- 渲染：[HyperFrames](https://hyperframes.heygen.com)；时间轴：[GSAP](https://gsap.com)。

## 许可

MIT，见 [LICENSE](LICENSE)。

---

**English.** An Agent Skill (built and tested with Claude Code) that turns a classical Chinese poem into a 20–80 second ink-wash style 2D animation: a red dot walks the poem, each line is brushed onto a caption slip as it is recited, the last line is written stroke by stroke in step with the voice, and the dot becomes the seal. Every frame is drawn by code on a canvas; the score is synthesized with numpy; no images, footage or stock music. Docs and prompts are in Chinese. Early release: two films made, tested on macOS only.
