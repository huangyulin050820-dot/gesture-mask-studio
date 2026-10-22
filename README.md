# 折映 REFRACT · 手势影像实验室

一个完整的纯静态网页项目。通过摄像头识别双手，在实时画面上移动、缩放、叠加局部特效蒙版，并拍照、录制和下载合成影像。适合在 VS Code 编辑，上传 GitHub，部署 Cloudflare Pages。无需账号系统、数据库、后端或 API Key。

## 1. 在 VS Code 打开

先解压 ZIP，然后在 VS Code 中选择「文件 → 打开文件夹」，打开 `gesture-mask-studio`（包含 package.json 的这一层）。不要直接在 ZIP 中编辑。

### 方式 A：VS Code Live Server（无需 Node.js）

1. 在 VS Code 扩展中安装 Live Server。
2. 打开 `public/index.html`，右键选择 **Open with Live Server**。
3. 浏览器打开 localhost 或 127.0.0.1 地址后，点击「开启摄像头」并允许权限。
4. 本项目已有 `.vscode/settings.json`，Live Server 默认以 public 为根目录。

### 方式 B：Node.js

安装 Node.js 18 或更高版本，在项目根目录的终端输入：

```bash
npm run dev
```

然后访问 `http://localhost:4173`。本项目零 npm 运行依赖，不需要 npm install。按 Ctrl+C 结束服务。

**不要双击 HTML 使用 file:// 打开**：JavaScript 模块、WASM 和摄像头需要正确的 HTTP / HTTPS 环境。网页部署到线上后使用 HTTPS。手机访问电脑的普通局域网 HTTP IP 地址通常不能使用摄像头；手机测试请使用部署后的 HTTPS 链接。

## 2. 你可以做什么

- 6 种实时效果：热感伪彩色、故障扫描、红青色差、反相负片、液态波纹、黑白颗粒。
- 最多 6 个独立图层，支持重叠、排序、隐藏、删除和清空。
- 每层不透明度 10%–85%，能透出下层和原始摄像头画面。
- 矩形、圆角矩形、椭圆蒙版；正常叠加、滤色、正片叠底、柔光混合。
- 单手捏合拖动；双手捏合移动与等比缩放；V 手势停留约 1 秒拍照。
- 鼠标拖动、右下角缩放、滚轮缩放；手机触屏拖动和右下角缩放。
- 1280 × 720 PNG 拍照，合成画面视频录制和下载。
- 镜像切换、辅助线开关、全屏、前后摄像头切换。
- 无摄像头时可使用动态演示画布，依然可以拍照和录制。
- 手机与桌面响应式排版；深色界面与中文操作提示。

注意：「热感映射」是根据画面亮度生成的艺术伪彩色效果，不是真实温度测量。效果是参考图中局部叠加视觉的网页实现，不依赖 TouchDesigner。

## 3. 手势操作

| 操作 | 方法 |
| --- | --- |
| 抓取蒙版 | 手伸到画面中的蒙版范围，拇指和食指捏合，然后移动手 |
| 放下蒙版 | 松开拇指与食指 |
| 双手缩放 | 先点击选中图层，再让两只手各自捏合；拉开放大、靠近缩小 |
| 双手移动 | 双手同时捏合并向同一方向移动 |
| 手势拍照 | 仅伸出食指、中指形成 V，保持约 1 秒；放下手才能再次触发 |
| 暂停手势 | 点击「手势识别：已开启」；再次点击恢复 |

尽量让手掌、手腕和指尖都进入镜头，保持光线充足，避免手部相互遮挡。双手跟踪交换或丢失时，松开捏合再重新抓取。正对镜头更容易识别 V 手势。用户设备的摄像头清晰度、光照和性能会影响识别效果。

键盘快捷键（焦点不在按钮或输入控件上时）：空格拍照，R 开始/停止录像，Delete 删除选中蒙版。点击按钮、拖动控件和手势操作都可混合使用。

## 4. 照片与录像保存

1. 点击「拍照」，或做 V 手势。照片出现在「灵感留存」。
2. 点击「开始录制」，完成后点击「停止录制」。
3. 在作品卡片中预览并点击「下载」。

导出只包含实时底图和特效蒙版，不包含界面、选中边框、骨架和操作提示。录像**不录制声音**。Chrome / Edge 通常导出 WebM；支持 MP4 的浏览器可回退导出 MP4，文件扩展名自动匹配实际格式，不伪装成 MP4。

每段录像上限 3 分钟，超过约 70 MiB 时自动结束；切换到后台、关闭摄像头时也会结束。作品最多暂存 12 项，达到容量阈值后需先下载并删除部分作品。所有作品仅在本次页面会话中临时保留，刷新、关闭页面会丢失，务必先下载。手机浏览器可能打开文件预览或分享菜单，按系统提示保存。

录制分辨率固定 1280 × 720；30 FPS 是请求目标，实际帧率随设备性能和浏览器调度变化，不保证恒定。弱性能手机可减少图层数量、关闭辅助线或暂停手势识别。

## 5. 上传 GitHub

新建一个空 GitHub 仓库，在项目根目录执行下面命令。把示例地址替换为你自己的仓库地址：

```bash
git init
git add .
git commit -m "Add Refract gesture mask studio"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/YOUR_REPOSITORY.git
git push -u origin main
```

也可以使用 VS Code「源代码管理 → 发布到 GitHub」。整个 `public/vendor` 必须提交：包含模型、WASM 和运行库，缺少其中的文件会导致手势识别无法启动。单个依赖文件约 10 MB 以下，项目不依赖 Git LFS。

## 6. 部署 Cloudflare Pages

### 方案 A：连接 GitHub（建议）

1. 在 Cloudflare 的 **Workers & Pages** 中创建应用，进入 **Pages**。
2. 选择导入已有 Git 仓库，授权并选择刚才上传的仓库。
3. 使用下面配置：

| 配置项 | 填写内容 |
| --- | --- |
| Production branch | main |
| Framework preset | None |
| Build command | exit 0 |
| Build output directory | public |
| Root directory | 留空（仓库根目录就是本项目时） |
| Environment variables | 无需填写 |

4. 部署后打开 Cloudflare 返回的 HTTPS 地址，允许摄像头权限。
5. 后续 push 到 main，Pages 会根据项目配置重新部署。

如果你把整个项目文件夹放在仓库的一个子目录里，应把 Root directory 改为那个子目录；确保输出目录指向包含 index.html 的 public。

### 方案 B：直接上传

创建 Pages 的 Direct Upload 项目，上传本项目的 **public 文件夹内容**。上传后的站点根目录必须直接包含 index.html、style.css、app.js、renderer.js、gestures.js、vendor 和 _headers。不要把包含 README 的整个源码 ZIP 当作站点根目录上传。

也可运行 `npm run build` 生成内容相同的 dist 文件夹，再上传 dist 的内容。若使用 Git 构建方案，亦可设置 Build command 为 `npm run build`、Build output directory 为 `dist`，这与前面的无构建配置二选一。

### 如果使用 Cloudflare Workers 的静态资源部署

项目提供 `wrangler.jsonc`，静态资源目录为 public。安装或使用 Cloudflare 官方 Wrangler 后运行 `npx wrangler deploy`，按其提示登录。此方案与 Pages 二选一；不要把本项目当作需要 Worker 服务端入口的项目。

官方部署说明：https://developers.cloudflare.com/pages/framework-guides/deploy-anything/

## 7. 项目结构

| 路径 | 用途 |
| --- | --- |
| public/index.html | 页面结构、中文文案、使用指南 |
| public/style.css | 桌面、平板、手机样式 |
| public/app.js | 摄像头、图层、手势交互、拍照、录像与下载 |
| public/renderer.js | 动态演示画布、六种局部效果、透明合成、辅助线 |
| public/gestures.js | 捏合/V 手势判定、镜像坐标、边界约束 |
| public/vendor/ | MediaPipe 运行库、WASM、手势模型和许可证 |
| public/_headers | Cloudflare Pages 响应头 |
| scripts/serve.mjs | 无第三方依赖的本地静态服务 |
| scripts/build.mjs | 将 public 复制为 dist |
| tests/gestures.test.mjs | 坐标、手势判定、缩放和边界测试 |
| wrangler.jsonc | Cloudflare Workers 静态资源部署配置 |

修改界面颜色：编辑 style.css 顶部 :root 变量。修改手势灵敏度：编辑 gestures.js 中 pinch ratio 阈值（进入 .30，退出 .43）。修改默认蒙版：编辑 app.js 的 addLayer 与初始组合。添加新特效：在 renderer.js 的 EFFECTS 和 process 中扩展。

## 8. 隐私、依赖与兼容性

- 所有摄像头画面、手势点、照片和录像都只在浏览器本机处理。本项目不上传影像、不调用云端识别、不访问麦克风、不添加分析追踪。
- 模型和运行库已放在 vendor，网页运行时只请求自身站点资源，不依赖外部 CDN。首次打开站点仍需下载这些资源。未配置 Service Worker，不承诺浏览器离线重开站点。
- MediaPipe Tasks Vision：0.10.22-rc.20250304；Hand Landmarker：float16/1。依赖版本已固定。第三方许可证见 vendor/LICENSE，来源见 THIRD_PARTY.md。
- 优先使用桌面 Chrome / Edge。其他浏览器的 WASM、Canvas captureStream 和 MediaRecorder 支持可能不同；页面会提示不支持的功能。iOS / 微信内置浏览器的摄像头和下载行为请以设备实测为准。
- GPU 初始化失败会尝试回退 CPU，但 MediaPipe 图像预处理仍需要可用的 WebGL 上下文；禁用图形加速的环境可能无法识别手势。模型在浏览器主线程中以约 13 次/秒上限推理，渲染目标约 30 FPS，特效中间图分辨率 480×270。不要将目标帧率理解为性能保证。

## 9. 检查与排错

```bash
npm test
npm run build
```

- 摄像头无法打开：检查 HTTPS/localhost、站点权限、系统摄像头权限，以及是否被其他程序占用。
- 页面顶部出现黄色提示「页面正以 file:// 方式打开…」：表示当前是通过双击 HTML 或 VSCode 内置预览打开，浏览器会拦截手势识别所需的模块与 WASM。请改用 Live Server 或 `npm run dev` 以 http://localhost 方式打开。
- 模型加载失败：检查 vendor 及其 wasm 子目录是否完整上传，文件名大小写是否一致。不要设置禁止 WebAssembly 的自定义 CSP。
- 线上 404：确认 Cloudflare 输出目录为 public，且该目录中有 index.html。
- 不出现手势框：先确认状态为「手势识别：已开启」，将整只手放进画面，并打开「辅助线」。
- 页面变慢：减少图层数量，关闭其他占用 GPU 的程序；实际性能以设备实测为准。
- 拍照和录像不会自动写入你选择的磁盘目录，需要点击作品卡片上的下载。

交付验证范围见 VALIDATION.md。项目源码与部署配置已经备齐，本次未代登录或发布到你的 GitHub / Cloudflare 账号。
