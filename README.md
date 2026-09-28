# 复旦漫游记 · Fudan Garden Adventure

基于 Three.js / WebGL 的可玩校园漫游原型。以复旦探索海报和林间冒险游戏画面为视觉参考，结合校园地标、茂密植被、春日光影与轻量游戏界面。

## 打开项目

Windows：双击根目录 `start.bat`。启动器查找 Node.js、启动本地服务，然后打开浏览器。当前工程已安装依赖。

常规开发环境：

```sh
npm install
npm run dev
```

如果只有 Node.js、没有 npm，但已有 node_modules：

```sh
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173
node node_modules/vite/bin/vite.js build
```

浏览器访问 http://127.0.0.1:5173/ 。生产构建输出在 dist/，可部署到静态 HTTP 服务，不能直接双击 HTML 运行。

## 已实现

- 实时 3D 场景：713 棵风格化树木、草丛、花朵、湖水、天鹅、飘落花瓣与阴影。
- 可选北极狐「阿雪」、女性探险家「小娜」与男性漫游者「小鸣」；小娜参考提供的角色图片，采用短黑发、绿色围巾、卡其探险装、斜挎包和短靴，小鸣采用短黑发、黑色夹克和长裤、浅底运动鞋与黑色小背包；人物包含步行、奔跑、待机及配饰摆动动画。
- 首页选择角色后出发，漫游中点击左下角头像可随时切换。角色选择随浏览器存档保存，切换保留位置、目的地和探索进度；三位角色使用相同的移动速度与碰撞规则。
- WASD / 方向键按屏幕方向移动，Shift 奔跑。
- 点击地面进行 A* 寻路；任务列表和地图目的地发起步行导航，键盘移动取消导航。
- 拖动旋转镜头，滚轮缩放，正交俯视镜头平滑跟随。
- 动态遮挡透视：挡住主角的建筑、围墙和树木自动淡化，离开遮挡后平滑恢复；碰撞与寻路不变。
- 12 处任务地标自动打卡、12 枚记忆收集，以及一处樱花湖景休憩点；完成后获得纪念印章。
- 全校小地图和 M 键打开的大地图；按四个片区筛选任务与目的地，点击地图标签或目的地按钮步行前往。
- 午后 / 黄昏 / 夜晚循环切换，光照与雾色平滑过渡；时段选择随存档恢复。夜晚有冷色月光、暖色路灯、地面光晕、发光窗户及暗色湖面，手机右上角同样可切换。
- 可开关的合成音乐、真实场景 PNG 明信片下载。
- 当前浏览器 localStorage 存档；帮助面板内可以重新开始。
- 手机透明虚拟摇杆（360° 方向、推幅控制步行速度、中心防漂移）与窄屏布局，模态窗口打开时暂停移动。
- 手机游玩采用收起的任务与地图入口；故事先显示短提示，点击后阅读。任务详情可筛选并发起导航，阅读时暂停移动；场景只显示最近一处地标名称，底部保留透明摇杆、角色头像与记忆数。适配竖屏、触屏横屏和安全区。
- 静态场景按空间网格与材质合批，使远处模型能够被视锥剔除，草地花朵使用 InstancedMesh，设备像素比上限 1.75。
- 运行资源本地提供，无需外部字体、图片或在线地图服务。

## 操作

| 操作 | 功能 |
|---|---|
| WASD / 方向键 | 按屏幕方向行走 |
| Shift | 奔跑 |
| 点击地面 | 自动寻路 |
| 点击任务 | 前往地标；记忆任务前往最近未收集点 |
| 拖动画面 | 旋转视角 |
| 鼠标滚轮 | 漫游中拉近 / 拉远 |
| M | 打开 / 关闭校园地图 |
| 靠近地标 / 金色记忆 | 自动打卡 / 拾取 |
| 左下角角色头像 | 切换阿雪 / 小娜 / 小鸣，保留当前旅程 |
| 右上角时段按钮 | 午后 → 黄昏 → 夜晚 → 午后 |
| 右上角其他工具 | 音乐、照片、操作帮助 |

## 范围与内容来源

本版按照用户提供的复旦大学地图扩展**相对布局**：西侧教学区、北侧光华楼、东侧教学区和邯郸路南侧片区，重点增加地图圈出的第四教学楼、李达三楼和史带楼。

可探索边界从 90 × 76 扩大为 240 × 196，平面面积约为原来的 6.88 倍；包含 30 个建筑模型、两处指路牌、运动场、连续步道与三处人行横道。道路为游戏操作适度拉直，建筑轮廓、比例、植被、湖景和文创店仍是艺术化表达，并非精确 GIS 或真实建筑复原。没有将参考图直接铺成 3D 场景。

旧版本浏览器存档继续保留原有地标与记忆记录。首次载入新布局时角色回到校门，避免旧坐标落入新建筑；新增任务和记忆正常计入进度。新版本的坐标在刷新后照常恢复。

相辉堂的基础沿革与建筑色彩参考[复旦大学官网《相辉堂》](https://www.fudan.edu.cn/2019/0426/c525a96263/page.htm)。建筑保留可辨认轮廓，使用程序化几何建模。

此前工程的 OSM 快照、地图更新脚本和 Arnis / Minecraft 文件保留，但**当前漫游地图不叠加 OSM 数据**，避免真实轮廓与艺术化地标重叠。如使用、分发原始 OSM 数据，需保留 [OpenStreetMap 贡献者署名与 ODbL 许可](https://www.openstreetmap.org/copyright)。

## 从学校地图生成模型包

个人技能已安装于 `C:/Users/win/.codex/skills/school-map-to-campus/SKILL.md`。在 Codex 附上学校地图并说：

> 使用 $school-map-to-campus，根据这张地图生成适用于 D:/3Dschool 的校园模型包。

技能先解释地图，再调用技能内置的建模配方，输出 `campus.glb`、`campus.json`、GLB 回读预览、可达性报告、识别与估测记录和 ZIP。GLB 是静态模型；漫游入口读取 JSON，保留碰撞、寻路、三角色、夜景和动态透视。平面图缺少的高度、屋顶、立面按艺术化估测记录。

导入生成的文件夹：

**直接在网页导入**：点击右上角“校园”，选择技能输出的 `campus.json` 或完整模型包 ZIP，查看学校名称与体量后点击“进入这座校园”。文件保存在当前网站的浏览器 IndexedDB 中，刷新后可继续；“我的校园”列表可重新进入、移除或返回复旦。此方式不上传服务器，只在导入时使用的浏览器与网站地址生效；换设备或清除网站数据后需重新导入。同名不同版本分别保存进度，重复导入相同文件会复用原记录。JSON 上限 2 MB、ZIP 上限 80 MB，ZIP 只解压校园 JSON，不加载大型 GLB。

**随网站部署给所有玩家**：使用下面的命令将 JSON 安装到项目，再重新构建部署。

```powershell
python C:/Users/win/.codex/skills/school-map-to-campus/scripts/import_package.py --package "模型包文件夹" --project D:/3Dschool
```

导入工具检查 SHA-256 并将 JSON 放入 `public/campuses/<学校ID>/campus.json`，访问 `/?campus=<学校ID>`。不带参数仍进入原有复旦地图；各校园独立存档。同名文件不会被覆盖。

已导入的验证样例：`/?campus=fudan-map-package-v1` 为现有复旦布局导出的模型包；`/?campus=example-school-v1` 为四栋建筑的合成模板，用于验证非复旦学校流程。模板不是地图复原结果。

重新运行构建后，上传 `dist/` 的全部内容即可静态部署这些校园。GLB 交付件保存在 `artifacts/`，不必随网页上传。独立技能生成工具只需 Python 3.10+ 和本机 Chrome/Edge/Chromium，无需本项目、Vite、Node 或 Playwright；完整说明见技能的 `INSTALL.md` 与 `references/build-import.md`。

## 知乎登录与 Cloudflare 部署

已支持 Cloudflare Pages / Workers 无服务器知乎 OAuth 登录，游客仍可直接漫游。右上角「登录」发起授权，成功后显示账号昵称；校园进度仍为浏览器本地存档。App Key 仅从 Cloudflare Secret 读取，不进入前端。

当前默认使用 Workers Builds：根目录 `wrangler.jsonc` 和 `wrangler.worker.jsonc` 均包含后端入口 `cloudflare/worker.js`、静态资源与 `AUTH_DB` 绑定。GitHub 构建命令为 `npm run build`，部署命令为 `npx wrangler deploy`。部署需要初始化 D1，并在这个 Worker 上添加运行时 Secret `ZHIHU_APP_KEY`，详见 [完整部署步骤](docs/cloudflare-zhihu-login.md)。如果原 Worker 只有静态资源，先发布包含后端入口的新版本，再添加 Secret。可选 Pages 配置保留在 `cloudflare/pages-config.example.jsonc`，使用 Pages 时需将其复制为根配置。只有普通静态资源托管时不提供登录服务。

## 首页校园选择与部署

点击首页或漫游界面右上角「校园」，即可选择复旦大学、上海交通大学（徐汇）、同济大学（四平路）和华东师范大学（中山北路，2001 年地图）。无需手动导入文件。不带查询参数的首页始终进入复旦，各校园分别保存探索进度、角色与时段。

内置列表由 `src/data/builtinCampuses.js` 管理，地图与预览放在 `public/campuses/`。三个新增校园的 JSON 和预览直接取自提供的 ZIP；游戏使用 JSON 在浏览器中建立模型，不需要重复下载包内的 GLB 与建模报告。原有本地 JSON/ZIP 导入功能继续可用。

直接链接：`?campus=sjtu-xuhui-map-v2`、`?campus=tongji-siping-v22`、`?campus=ecnu-zhongshan-2001-v1`。也支持部署到子目录。

运行 `npm run build` 后，上传 **整个 `dist/` 的内容**（包括 `assets/`、`campuses/`、`characters/` 和 `index.html`）到静态服务器。不能只更新地图文件，否则旧网页仍不包含校园选择入口。`artifacts/3dschool-multi-campus-dist.zip` 是本次完整静态部署包，解压内容即网站根目录。

`python -X utf8 scripts/verify-builtin-campuses.py` 可启动临时静态服务并验证已构建的 `dist/`：校园选择、默认复旦、各校园任务可达性、存档隔离、本地导入、手机布局以及子目录部署。

## 代码结构

- src/data/fudanCampus.js：布局、地标、交互接近点、记忆和文案。
- src/data/campusPackage.js：校园 JSON 文件契约校验与按 URL 加载。
- src/tools/campusPackageBuilder.js：真实建模、路径验证、GLB 导出回读及预览。
- src/world/CampusBuilder.js：场景组装、碰撞、标签与收集物。
- src/world/garden.js：纹理、树林、草花实例、水面着色器与合批。
- src/world/buildings.js：原有地标及修复后的四坡屋顶。
- src/world/expandedBuildings.js：教学楼、图书馆、管理学院楼宇与运动场。
- src/render/CampusEnvironment.js：三种时段、平滑光照过渡、窗户与路灯发光、附近路灯光源池。
- src/render/OcclusionFader.js：主角多点遮挡检测、逐物体淡化与恢复。
- src/player/ArcticFox.js / XiaoNa.js / XiaoMing.js：三位角色的程序化模型；CampusWalker.js 复用人物步行、奔跑和待机动画。
- src/player/characters.js：角色名称、头像与显示设置；public/characters/ 中的预览图直接由游戏模型渲染。
- src/game/Game.js：游戏循环、运动、相机、存档、环境与照片。
- src/game/Navigation.js：碰撞网格和偏好道路的 A* 寻路。
- src/game/Input.js：键盘、虚拟摇杆与失焦清理。
- src/ui/hud.js：任务、对话框、地图绘制与交互。

## 验证

```sh
node node_modules/vite/bin/vite.js build
python scripts/verify-browser.py
python scripts/verify-campus-packages.py
python scripts/verify-campus-import.py
python scripts/verify-mobile-hud.py
python scripts/verify-joystick.py
python scripts/verify-occlusion.py
python scripts/verify-night.py
python scripts/verify-characters.py --character nana
python scripts/verify-characters.py --character ming
```

浏览器验证需要 Python Playwright（python -m pip install playwright）、Windows Chrome，以及运行在 5173 的开发服务。测试使用独立无头浏览器，不使用个人登录信息。

覆盖键盘移动、寻路完成全部任务、地图选点、建筑碰撞、存档恢复、昼夜切换、音乐开关、照片下载、视角拖动、缩放、触屏操作与窄屏布局。截图和结果输出在 artifacts/。

校园数据在场景初始化时执行 validateCampus 校验；Vite 构建检查模块编译，浏览器验证负责运行时行为。

遮挡验证另外覆盖楼后透视、楼前恢复、镜头旋转、建筑与树木叠加遮挡、渐变过程、角色材质隔离、窄屏视角和绘制次数。输出 `artifacts/occlusion-verification.json` 及前后对比截图。

角色验证覆盖首页选择、行走动画、旅途中切换、位置与进度保持、刷新恢复、旧存档兼容、小娜和小鸣完成全部任务、建筑透视，以及手机选角和触屏移动。输出 `artifacts/characters-nana-verification.json`、`artifacts/characters-ming-verification.json` 及截图。旧存档没有角色字段时默认使用阿雪；重新开始旅行会保留当前角色。修改角色外观后，可运行 `python scripts/render-character-portraits.py` 重新生成头像，再构建部署。

透视在主角脚部、躯干、头部及两侧发出正交视线，每秒检测 30 次，并保留短暂迟滞以避免建筑边缘闪烁。静态合批仍然保留，每个建筑或树木通过独立编号读取淡化值。采用一致的屏幕覆盖图案和抗锯齿采样，避免重叠屋顶、墙面重复混合后重新挡住角色；不支持多重采样时使用像素网点效果。透视仅影响画面，建筑仍有实体碰撞和阴影。

夜景验证输出 `artifacts/night-verification.json`，覆盖三时段循环、白天灯光关闭、时段存档恢复、夜间行走与导航、建筑透视、照片导出及手机时段按钮。路灯光晕采用两组合批绘制，实际照明复用最多四个附近点光源，不为全校每盏灯单独创建动态光源；夜景不额外增加阴影贴图。

手机摇杆松手后停止并回中；触控取消、失去指针捕获、打开弹窗、页面失焦与屏幕尺寸变化也会重置输入。摇杆拖动不旋转镜头，手动触碰摇杆会取消自动导航。
