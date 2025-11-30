## DOM 塔防卡 / DOM Tower Defense

一个完全基于 HTML/CSS/Vanilla JS 的休闲塔防卡牌游戏。拖拽（点击）卡牌放塔、防守多路线敌人、收集特殊样式与布局加成，所有逻辑都运行在浏览器里，不需要额外依赖。

### 特色速览

- **卡牌 × 塔防**：起手 5 张塔牌，按能量消耗放置到网格战场。
- **动态地图**：每个关卡都有独立障碍、入口、基地位置以及波次脚本。
- **多塔型**：Rapid、Explosive、Sniper、Executioner、Percentile 等数十种塔，包含样式/布局卡叠加效果。
- **敌人行为多样**：冲刺、干扰、治疗、Boss 以及脚本怪会干扰塔。
- **无依赖部署**：纯静态资源，可直接托管到任意静态服务器。

---

## 环境要求

- **Python ≥ 3.8**：仅用于本地起一个静态服务器（脚本位于 `scripts/local_server.py`）。
- 任意现代浏览器（Chrome / Edge / Firefox / Safari 均可）。

> 如果系统尚未安装 Python：
> - Windows 可执行 `winget install -e --id Python.Python.3.12`
> - macOS 使用 `brew install python@3.12`

---

## 快速开始

### macOS / Linux

1. 克隆或下载本仓库后，进入项目根目录。
2. 双击 `start-game.command`（或在 Terminal 里执行 `./start-game.command`）。
3. 脚本会自动定位 Python 并运行 `scripts/local_server.py`，随后打开浏览器访问游戏。

### Windows

1. 双击 `start-game.bat`。
2. 批处理会查找 `py/python/python3`，启动 `http.server` 并自动打开 `http://localhost:8000/index.html`。

### 手动方式（跨平台）

```bash
python3 scripts/local_server.py --port 8080 --entry index.html
```

出现 `访问地址： http://localhost:8080/index.html` 即可复制到浏览器。

关闭服务器：回到终端按 `Ctrl + C`。

---

## 操作与玩法

| 操作 | 描述 |
| --- | --- |
| 点击手牌 | 选中卡牌，进入放置模式 |
| 点击战场网格 | 放置塔。系统会阻止覆盖基地/入口/敌人或堵死路径 |
| 右键 / Esc | 取消当前放置 |
| 右下角按钮 | 暂停、倍速、返回主菜单 |

- 能量会随时间回复，放塔消耗能量。
- 每波敌人清掉后会显示提示，准备下一波。
- 如果基地血量降为 0 游戏失败，完成全部波次胜利。

---

## 关卡内容

- 目前内置 9 个关卡（见 `src/game/config.js -> LEVELS`），包含常规布局、双通道、十字路口、Boss 战等。
- 每关都带有 `description / recommended / enemyTypes / previewPaths`，可根据需要拓展。

---

## 目录结构

```
card/
├── index.html          # 游戏主页面
├── styles.css          # 所有 UI 样式
├── src/
│   ├── main.js         # 入口脚本 & 启动逻辑
│   ├── game/           # 核心模块：塔、敌人、关卡、UI
│   └── utils/          # 错误提示等工具
├── scripts/
│   └── local_server.py # 本地静态服务器
├── start-game.*        # 快捷启动脚本（Win / macOS）
└── README.md
```

常见扩展点：

- 新塔牌：在 `src/game/cards.js` & `src/game/config.js -> TOWERS_CONFIG` 中添加。
- 新敌人：修改 `ENEMY_TYPES / ENEMY_CONFIGS` 并在 `LEVELS` 的 `waves` 里引用。
- UI 调整：主要在 `styles.css` 和 `src/game/ui.js`。

---

## 常见问题

1. **运行脚本提示找不到 Python？**  
   请确认已经安装并加入 PATH，可在终端输入 `python3 --version` 检查。

2. **浏览器没有自动打开？**  
   复制终端显示的 URL，手动粘贴到浏览器即可。

3. **敌人不走路或被堵死？**  
   已默认开启新寻路 + 堵路检测。如果仍出现问题，可在 `src/game/featureFlags.js` 中临时关闭 `newTowerBlockCheck` 进行排查。

---

## 贡献方式

欢迎 PR / Issue：

1. Fork 仓库并创建分支。
2. 完成改动后提交 PR，说明变更点与测试方式。
3. 若涉及数值或关卡，请附上截图或复现步骤，方便验证。

---

## 许可证

本项目采用 MIT License，详见 `LICENSE`。