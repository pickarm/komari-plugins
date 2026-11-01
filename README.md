# pickarm 的 Komari 插件合集

同一仓库托管多个独立的 Komari 插件，每个插件在 `plugins/<short>/` 中独立开发、测试及打包。根目录 `v1.json` 是可以添加到 Komari 插件市场的自用目录。

在 Komari 后台 → 插件市场 → 管理源中添加：

- 名称：`pickarm 自用插件`
- 地址：`https://raw.githubusercontent.com/pickarm/komari-plugins/main/v1.json`

## 当前插件

| 插件 | 目录 | 要求 |
| --- | --- | --- |
| Ping 告警与报告 | [plugins/ping-alert](plugins/ping-alert) | Komari >=1.6.1 |
| 网络检测与历史报告 | [plugins/network-quality](plugins/network-quality) | Komari >=1.6.1、Linux Agent |

Ping 告警默认连续异常 **10 次实际探测**才通知，连续成功 2 次后通知恢复。支持延迟与丢包率阈值、中文通知模板预览及模拟发送；日报、周报、月报及自定义报告仅包含已开启的检测项，两项关闭时不生成。检查间隔和回溯配置已移除。配置详情及限制见插件自身 README。

网络检测插件提供三网回程表、延迟丢包、流媒体/AI 解锁、线路变化提醒、历史保存和按节点定时，安装后定时默认关闭。主题展示适配见 [Junimo 二次开发版](https://github.com/pickarm/komari-themes)，插件后台也可独立使用。仓库中各插件独立声明许可证；网络检测插件及其引擎的许可和来源见对应目录。

## 新增插件

1. 在 `plugins/<short>/` 建立独立插件工程。
2. 测试后发布包含根目录 `komari-plugin.json` 的 ZIP。
3. 把插件元数据、安装包地址和该 ZIP 的 SHA-256 加入根目录 `v1.json`。
4. 在 Komari 插件市场刷新此源即可显示新增插件。

目录始终保留上一次已下载核验的发布包，直到新包构建、下载与 SHA-256 校验完成后再更新；源码版本可领先目录，目录不能领先源码。

每个插件的包名、short 和发布资源名应保持唯一。发布标签推荐 `<short>-v<version>`，例如 `ping-alert-v1.0.1`，避免不同插件共用一个版本号。

## 当前状态

原 `komari-ping-alert` 仓库已更名为 `komari-plugins`，保留历史提交与 v1.0.0 Release。现有 v1.0.0 安装包保持原样，目录指向更名后的下载地址；后续插件使用独立版本标签。官方插件市场提交暂停，等待实际使用验证。
