# py聚合

TVBox py 源聚合仓库。24 个源，全部经过存活测试（2026-10-15）。

## 导入地址

```
https://cdn.jsdelivr.net/gh/zxsla/pyjuhe@main/tvbox.json
```

> 仓库名如果不是 `pyjuhe`，把上面地址里的 `pyjuhe` 换成实际仓库名。
> raw 直链：`https://raw.githubusercontent.com/zxsla/pyjuhe/main/tvbox.json`

## 源列表

### 🎬 影视（12）
| 源 | 文件 |
|---|---|
| 4KMP影视 | py_4kmp.py |
| 永乐视频 | py_yongle.py |
| UVOD影视 | py_uvod.py |
| 优酷影视 | py_youku.py |
| FreeOK影视 | py_freeok.py |
| 云朵影视 | py_yunduo.py |
| 初见影视 | py_chujian.py |
| 好剧影视 | py_haoju.py |
| 农民影视 | py_nongmin.py |
| 爱奇艺影视 | py_iqiyi.py |
| 腾讯视频 | py_tencent.py |
| 6V电影 | py_6v.py |

### 📱 短剧（6）
| 源 | 文件 |
|---|---|
| 红果短剧 | py_hongguo.py |
| 河马短剧 | py_hema.py |
| 五五短剧 | py_55duanju.py |
| 牛牛短剧 | py_niuniu.py |
| 短剧巴士 | py_duanjubus.py |
| 五五短剧2 | py_55dj2.py |

### 🎌 动漫（1）
| 源 | 文件 |
|---|---|
| 哈密瓜动漫 | py_hamigua.py |

### 🎵 音乐音频（5）
| 源 | 文件 |
|---|---|
| DJ呦呦音乐 | py_djuu.py |
| DJ呦呦2 | py_djuu2.py |
| 爱听音乐 | py_music.py |
| 酷我音乐 | py_kuwo.py |
| 听友FM | py_tingyou.py |

## 已剔除

- 18+ / 成人源 18 个（含 DSYS、whos.tv 等测试中现形的）
- 失效源：番茄短剧、555影视、山楂影视、八戒影视
- 非 TVBox 源（独立工具脚本）：喜马拉雅、央视频直播、本地源扫描器

## 部署

1. 新建公开 GitHub 仓库（TVBox 用 raw 链接，仓库必须公开）
2. 把本目录所有文件上传到仓库根目录
3. TVBox 里导入上面的 `tvbox.json` 地址（类型自动识别）

## 维护

- 加源：上传 py 文件，在 `tvbox.json` 的 `sites` 里加一条（`type: 3`，`api` 填 jsDelivr 地址）
- 删源：删 py 文件 + 删 json 里对应条目
- 换仓库名：把 `tvbox.json` 里所有 `zxsla/pyjuhe` 换成新名
