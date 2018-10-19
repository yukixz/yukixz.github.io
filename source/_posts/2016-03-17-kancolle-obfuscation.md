---
layout: post
title: "「艦隊これくしょん」混淆与反混淆"
date: 2016-03-17 01:18:52 +0800
comments: true
categories: 
alias: /blog/2016/03/17/kantai-collection-obfuscation-anti-obfuscation/
---

「艦隊これくしょん」出于反 Bot 和未知目的，对游戏资源进行了不少混淆处理。

本文列举将会列举部分资源的混淆算法，并给出整理后的混淆算法或反混淆算法。

注意：此些算法都具有时效性，建议在使用前进行测试。


## 体例

* `Core.swf/common.util.SoundUtil/createFileName`：表示 `Core.swf` 文件中的 `common.util.SoundUtil` 类中的 `createFileName` 函数。


## Core.swf <a id='core-swf'></a>

*Last Update: 2017-02-15*

Core.swf 是游戏加载的第二个 swf 文件，由 mainD2.swf 读取、反混淆和加载运行。其反混淆函数为 `mainD2.swf/mainD2/___ `，该函数本身亦经过复杂的代码混淆。

反混淆算法原理：

1. 将 Core.swf 的 0~127 bytes 划为第一区域，128~EOF 划为第二区域。
2. 将第二区域按相等大小划分为 8 块，按 0, 7, 2, 5, 4, 3, 6, 1 的顺序重新排列。

反混淆脚本 `Core-decode.py Core.swf Core-dec.swf`：

{% codeblock lang:python %}
#!/usr/bin/env python3

import sys

ORDER = [0, 7, 2, 5, 4, 3, 6, 1]
SRC = sys.argv[1]
DEST = sys.argv[2]

with open(SRC, "rb") as f:
    org = f.read()

with open(DEST, "wb") as dec:
    size = (len(org) - 128) >> 3
    dec.write(org[0:128])
    for i in ORDER:
        dec.write(org[ i*size+128 : (i+1)*size+128 ])
{% endcodeblock %}


## 活动地图的 SP 部分 <a id='event-sp'></a>

*Last Update: 2017-02-15*

角川于 2016 年秋活（2016-11）新增了达成一定条件后解锁新增海域路径的机制。

该机制原理为：
1. 将新增的海域路径储存到额外的 SWF 文件中。
2. 将该额外 SWF 文件使用 [Core.swf](#core-swf) 相同的算法混淆处理。
2. 将混淆后的 SWF 文件作为二进制数据（Binary Data）嵌入到 `/kcs/scenes/SallyMain.swf` 中。

因此，只需要将 `SallyMain.swf` 嵌入的二进制文件保存为 SWF 文件，然后使用上述 `Core-decode.py` 即可反混淆。


## 活动地图的文件名 (swf) <a id='event-map'></a>

*Last Update: 2017-02-15*

自 2016 年冬活（2016-02-10）起，角川对活动地图的 swf 文件名进行了混淆，但通常图的文件名仍然遵循 `AA_BB.swf` 的格式。其混淆函数位于 `Core.swf/common.resources.MapResourceLoader/_convertName`。

该函数内 `__loc10__:String` 的值为一串正则表达式的结果，其值为 `"push"`，这是该函数内唯一的代码混淆。

该混淆函数的本质是对 `RND:Array` 的解压缩算法，建议直接阅读下面的算法。

{% codeblock lang:javascript %}
#!/usr/bin/env node

// Map ID
const mapArea = 33
const mapNo = 1

// RND is extract from Core.swf/common.resources.MapResourceLoader/RND
const RND = [3367, 28012, 6269, 26478, 24442, 27255, 28017, 3366, 
             6779, 7677, 7179, 28011, 24421, 27502, 3366, 7779, 
             24439, 27762, 6474, 7463, 28515, 3364, 6672, 28006, 
             27999, 27254, 7363, 6868] 

// Procedure 1: Decode
let RND1 = []
;(function () {
  for (let rnd of RND) {
    rndstr = rnd > 10000 ? rnd.toString(16) : rnd.toString()
    RND1.push(rndstr.substr(0, 2))
    RND1.push(rndstr.substr(2, 4))
  }
})()
console.log("RND1", JSON.stringify(RND1))

// Procedure 2: Group
// Format: 33 a b c d 32 j k l
let kfile = []
;(function () {
  let area = 0, file = ''
  for (let rnd of RND1) {
    rnd = parseInt(rnd, 16)
    if (rnd < 90) {
      if (file !== '') {
        area = parseInt(area.toString(16))
        kfile.push([area, file])
        file = ''
      }
      area = rnd
    } else {
      file += String.fromCharCode(rnd)  // 91=a, 92=b, ...
    }
  }
  kfile.push([area, file])  // Seems last item needn't to convert
})()
console.log("kfile", JSON.stringify(kfile))

// Procedure 3: Find
// Find No.`mapNo` of `kfile[i][0] == areaID`, and its file name is `kfile[i][1]`
;(function () {
  let i = 0
  for (let _ of kfile) {
    let area = _[0], file = _[1]
    if (area === mapArea) {
      i += 1
      if (i === mapNo)
        console.log(`${mapArea}-${mapNo}: ${file}`)
    }
  }
})()
{% endcodeblock %}


## 舰船语音的文件名 (mp3) <a id='ship-voice'></a>

*Last Update: 2016-03-17*

角川于 2016 冬活结束的维护（2016-02-24）中，对所有舰船语音的文件名进行了混淆，但仍保留旧的文件（`1~51.mp3`）。于 2016-02-29 的维护中，更改了混淆算法的 key 并删除了旧的文件，但没有修改混淆算法。

该混淆算法位于 `Core.swf/common.util.SoundUtil/createFileName`。该算法极为简单，且算法本身未有任何混淆。

整理后的混淆算法：

{% codeblock lang:javascript %}
# vcKey is extracted from Core.swf/common.util.SoundUtil
const vcKey = [604825,607300,613847,615318,624009,631856,635451,637218, 
               640529,643036,652687,658008,662481,669598,675545,685034, 
               687703,696444,702593,703894,711191,714166,720579,728970, 
               738675,740918,743009,747240,750347,759846,764051,770064, 
               773457,779858,786843,790526,799973,803260,808441,816028, 
               825381,827516,832463,837868,843091,852548,858315,867580, 
               875771,879698,882759,885564,888837,896168] 
# shipId: api_start2 . api_mst_ships [] . api_id
# voiceId: 1 ~ 51
convertFilename = (shipId, voiceId) =>
  (shipId + 7) * 17 * (vcKey[voiceId] - vcKey[voiceId - 1]) % 99173 + 100000
{% endcodeblock %}


## 战果排名的战果值混淆 <a id='rank'></a>

*Last Update: 2016-08-01*

角川于 2016-7-15 的维护更新中，对战果排名中的玩家战果值（`api_rate`）进行了混淆。此次混淆对不同玩家采用了不同的混淆值，且算法本身亦经过一定规模的混淆。角川与 2016-8-1 的维护更新中，对战果 API URL 和其字段进行了混淆，同时小幅更新了战果值的混淆算法。

本文不涉及战果 API URL 和其字段的混淆分析，请参考[其他信息](https://github.com/andanteyk/ElectronicObserver/blob/master/ElectronicObserver/Other/Information/apilist.txt#L1067)。

此混淆算法涉及到四个文件：核心部分为 `Core.swf/core.apis._APIBaseS_` 和 `RecoreMain.swf/scene.record.models.RankData/RankData`，次要部分为 `RecordMain.swf/scene.record.models.RankingData/setData` 和 `RecordMain.swf/connection.api_req_ranking.RankingListAPI/_handleLoadComplete`。

因为角川几乎在每次游戏维护都会修改混淆算法的 key，因此以下算法仅供了解原理，请前往 [poi 我变强了](https://github.com/ruiii/plugin-Hairstrength/blob/master/components/utils.es#L50) 查看最新的混淆 key。

{% codeblock lang:python %}
#!/usr/bin/env python3

import sys
from math import sqrt

# `Il` is extracted from 'core.apis._APIBaseS_/Il'
Il = [4999, 2257, 7351, 2039, 6604, 4132653, 1033183, 2570, 4979, 6314, 13,
      5478, 3791, 10, 9640, 6707, 1000, 1875979]
# Maigc number is calculated from 'core.apis._APIBaseS_/I1'
MAGIC_13 = str(sqrt(13))

if sys.version_info < (3, 0):
    # Python 2.x hard code
    MAGIC_13 = '%.15f' % sqrt(13)

MAGIC = [-1] * 10
for i in range(10):
    n = 0
    while MAGIC_13[n] != str(i):
        n += 1
    MAGIC[i] = Il[n]

# `_l_` is refactored from 'core.apis._APIBaseS_/_l_'
# Get the first two digits of the magic number
def _l_(id):
    return int(str(MAGIC[id % 10])[0:2])

# Magic R is extracted from 'scene.record.models.RankData/RankData'
MAGIC_R = [8831, 1201, 1175, 555, 4569, 4732, 3779, 4568,
           5695, 4619, 4912, 5669, 6569]
# `real_rate` is refactored from 'scene.record.models.RankData/RankData'
# We assume that it always is even divisible.
def real_rate(login_member_id, rank_no, rank_rate):
    return rank_rate / MAGIC_R[rank_no % 13] / _l_(login_member_id) - 73 - 18
{% endcodeblock %}
