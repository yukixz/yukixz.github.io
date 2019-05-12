---
title: Linux 通过 Samba+Avahi 搭建 Time Machine 服务
date: 2019-05-12 21:45:13
tags: [ Linux, Time Machine, Samba, Avahi ]
---


[Time Machine](https://zh.wikipedia.org/wiki/Time_Machine) 是 macOS 自带的系统级备份软件，配置完成后就可以在后台每天自动备份整机数据，防止手滑、丢失、送修等各种场景。然而实际上，除非购买苹果全家桶的 Time Capsule，不然每次备份还得手动移动硬盘，实在毫无便利性了。下面介绍一种方法，通过 [Samba](https://zh.wikipedia.org/wiki/Samba) 提供文件共享、 [Avahi](https://en.wikipedia.org/wiki/Avahi_(software)) 提供服务广播的方式，搭建通过网络进行备份的 Time Machine 备份服务器。

插播一句：Samba 最初是基于 Microsoft 的 SMB 文件共享协议开发的开源实现，Avahi 则是以 Apple 开源的 Bonjour 源码上发展而来的 zeroconf 实现，说到底还是原本就有的协议了。


## 基础环境
* Arch Linux 20190512
* Linux 5.0.13.arch1-1
* Samba 4.10.2-1
* Avahi 0.7+18+g1b5f401-2
* 备份数据路径：`/data/timemachine`


## 准备工作

简单略过，不做展开。
1. 安装 Samba+Avavhi：`pacman -S samba avahi`
2. 挂载备份硬盘：`disk`、`mkfs.ext4 ...`、`vim /etc/fstab`、`mount -a`


## 配置 Samba

首先，我们需要配置 Samba 提供文件共享服务，让 macOS 能够访问到备份数据路径。

首先，需要添加一个 Time Machine 专用的用户。我这里使用了个人用户，反正都是个人数据。
{% codeblock lang:shell %}
# useradd dazzy
{% endcodeblock %}

然后，设置该用户的 Samba 协议密码，这个密码跟 Linux 系统用户密码是相互独立的，需要单独设置。
{% codeblock lang:shell %}
# smbpasswd -a dazzy
{% endcodeblock %}

接着，就是配置 Samba 让它把备份数据路径暴露出去，直接贴配置文件了。
{% codeblock lang:ini /etc/samba/smb.conf %}
[global]
server role = standalone server
hosts allow = 10.42.0.
log file = /var/log/samba/%m.log
map to guest = Bad User
unix extensions = no
allow insecure wide links = yes
follow symlinks = yes
wide links = yes

[Warden TM]                 ; 服务名称，会显示在 Time Machine 备份界面
path = /data/timemachine    ; 备份数据路径
writable = yes              ; 允许SMB客户端写入
valid users = dazzy         ; 允许访问的用户列表，避免备份数据泄漏
; catia: 兼容linux/macos中合法但在Windows/SMB中非法的字符
; fruit: 增强macos的的兼容性，并提供Netatalk AFP服务
; streams_xattr: 通过Linux文件系统提供Windows NTFS属性字段
vfs objects = catia fruit streams_xattr
fruit:aapl = yes            ; 启用Apple SMB客户端兼容
fruit:model = MacPro        ; 修改一下Finder里的图标
fruit:time machine = yes    ; 重要！开启 Time Machine 支持！
{% endcodeblock %}

最后，就是把 Samba 服务起来啦，这里不要起错成 `samba` 了。
{% codeblock lang:shell %}
# systemctl enable --now smb
{% endcodeblock %}

这时候就可以通过 macOS Finder 里面的 Go > Connect to Server 验证一下 Samba 服务是否正常了。


## 配置 Avahi

Avahi 不需要配置。没错，直接启动就好了。
{% codeblock lang:shell %}
# systemctl enable --now avahi-daemon
{% endcodeblock %}


## 使用 Time Machine

到这里就可以使用了，在 Preferences > Time Machine > Select Disk 中就可以看到刚才配置的 `Warden TM`，点击就可以使用了。
