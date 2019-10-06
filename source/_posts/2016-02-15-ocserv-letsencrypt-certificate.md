---
title: ocserv + Let's Encrypt + 证书认证
categories: 
alias: /blog/2016/02/15/ocserv-letsencrypt-certificate/
hidden: yes
---

本文需要基础 Linux 知识与网络知识。  
请自行替换文内的所有全大写字段。  


## 简要原理
以下包含口胡，欢迎指正。

### TLS/SSL 证书认证
TLS/SSL 协议的允许连接双方都对端做身份认证。  
对服务器端认证一般采用证书认证的，对客户端认证一般采用用户名+密码的认证。  
由于每次都输入密码较为繁琐，因此对客户端亦采用证书认证的方式能更方便。  

### Let's Encrypt 签发流程 (WebRoot)
1. 客户端生成验证文件，存放到 `WEBROOT/.well-known/acme-challenge/`
2. 客户端告知 Let's Encrypt 服务器开始验证
3. 服务器读取 `http://DOMAIN/.well-known/acme-challenge/` 进行验证
4. 客户端向服务器查询验证是否成功
5. 若验证成功，向服务器获取证书

其中 1、3 为可能出现问题的地方，若获取证书失败，建议优先检查此部分。  
如：WEBROOT 不可被 letsencrypt 客户端写入；Let's Encrypt 服务器无法解析 DOMAIN 的 DNS；DOMAIN 对应的 IP 非 Let's Encrypt 客户端写入验证文件的主机等诸多问题。  


## 服务器证书
自建 CA 并签发服务器证书固然是可行方案，但需要在每台设备上都信任该自建 CA，较为麻烦且不安全。  
因此我采用 Let's Encrypt 来获取合法的服务器证书。  

*以下大部分命令需要 root 权限，但可以通过配置目录的读写权限绕过。*  
*建议同时阅读 [Let's Encrypt User Guide](https://letsencrypt.readthedocs.org/en/latest/using.html)。*

### 事前准备
1. 将域名 DOMAIN 的 A/AAAA 记录指向当前主机。  
2. 配置 HTTP 服务器，使 `WEBROOT/.well-known/acme-challenge/` 可被访问。  

### 获取证书
测试时建议加上 `--test-cert` 以免用完 Let's Encrypt 的证书获取速率限制。  
{% codeblock lang:bash %}
yum install certbot
certbot certonly --webroot -w WEBROOT -d DOMAIN
{% endcodeblock %}

### 自动更新证书
添加 cron 脚本至 `/etc/cron.monthly/certbot`，实现每月自动更新。  
{% codeblock lang:bash %}
#!/bin/bash

WD="/root/certbot"
LOG="${WD}/cron.log"

mkdir -p $WD
date >> $LOG
certbot renew >> $LOG
{% endcodeblock %}

## 用户证书
用户证书只需 ocserv 信任 CA 即可，因此使用自建 CA 签发证书。  
将以下脚本保存到 `/etc/ocserv/certs/`，然后运行 `./ocm generate USERNAME` 即可直接生成用户证书 `USERNAME.p12`。  
{% codeblock lang:bash %}
#!/bin/bash

init() {
    WORK="./work"
    CA_TMPL="${WORK}/ca.tmpl"
    CA_KEY="${WORK}/ca-key.pem"
    CA_CERT="./ca.pem"
    USER="$1"
    USER_TMPL="${WORK}/${USER}.tmpl"
    USER_KEY="${WORK}/${USER}-key.pem"
    USER_CERT="${WORK}/${USER}.pem"
    USER_P12="./${USER}.p12"
    REVOKED_CERT="${WORK}/revoked.pem"
    CRL_TMPL="${WORK}/crl.tmpl"
    CRL_CERT="./crl.pem"

    # Ensure working directory
    [[ -d $WORK ]] || mkdir -p $WORK

    # CA Template
    [[ -f $CA_TMPL ]] || cat << _EOF_ > $CA_TMPL
cn = "VPN CA"
serial = 1
expiration_days = 3650
ca
signing_key
cert_signing_key
crl_signing_key
_EOF_

    # CA Private Key
    [[ -f $CA_KEY ]] || certtool --generate-privkey --outfile $CA_KEY

    # CA Certificate
    [[ -f $CA_CERT ]] || certtool --generate-self-signed --load-privkey $CA_KEY --template $CA_TMPL --outfile $CA_CERT
}

generate() {
    # User Template
    cat << _EOF_ > $USER_TMPL
cn = "$USER"
expiration_days = 3650
signing_key
tls_www_client
_EOF_

    # User Private Key
    certtool --generate-privkey --outfile $USER_KEY

    # User Certificate
    certtool --generate-certificate --load-privkey $USER_KEY --load-ca-certificate $CA_CERT --load-ca-privkey $CA_KEY --template $USER_TMPL --outfile $USER_CERT

    # Export User Certificate
    certtool --to-p12 --pkcs-cipher 3des-pkcs12 --load-privkey $USER_KEY --load-certificate $USER_CERT --outfile $USER_P12 --outder
}

revoke() {
    # Copy User Certificate to Revoked Certificate
    cat $USER_CERT >> $REVOKED_CERT

    # CRL Template
    [[ -f $CRL_TMPL ]] || cat << _EOF_ > $CRL_TMPL
crl_next_update = 3650
crl_number = 1
_EOF_

    # CRL Certificate
    certtool --generate-crl --load-certificate $REVOKED_CERT --load-ca-privkey $CA_KEY --load-ca-certificate $CA_CERT --template $CRL_TMPL --outfile $CRL_CERT
}

case $1 in
    generate)
        init $2
        generate
        ;;
    revoke)
        init $2
        revoke
        ;;
    *)
        echo "\
Usage:
    $0 generate USER
    $0 revoke USER
"
esac
{% endcodeblock %}


## ocserv

### 编译安装 ocserv
注意安装依赖，阅读 `README.md` 即可。
{% codeblock lang:bash %}
VERSION='0.10.11'
cd /opt
wget ftp://ftp.infradead.org/pub/ocserv/ocserv-${VERSION}.tar.xz
tar xvf ocserv-${VERSION}.tar.xz
cd ocserv-${VERSION}
./configure
make
make install
{% endcodeblock %}

### 配置 ocserv
复制配置文件：`cp /opt/ocserv-${VERSION}/doc/sample.config /etc/ocserv/ocserv.conf`  
修改以下项：
{% codeblock lang:text %}
# 打开 PMTUD
try-mtu-discovery = true

# 以 CN 为用户 ID。（用户证书认证）
cert-user-oid = 2.5.4.3

# 服务器证书与密钥（Let's Encrypt）
server-cert = /etc/letsencrypt/live/DOMAIN/fullchain.pem
server-key = /etc/letsencrypt/live/DOMAIN/privkey.pem

# 如有需要，可修改 VPN 端口
tcp-port = 443
udp-port = 443

# 修改 VPN 子网网段（避免和常用内网网段相同）
ipv4-network = 192.168.111/24

# 修改 DNS
dns = 8.8.8.8
dns = 8.8.4.4

# 注释掉所有的 route，让服务器成为 gateway
#route = 192.168.1.0/255.255.255.0
{% endcodeblock %}

### 配置服务器
修改 `/etc/sysctl.conf` 中的 `net.ipv4.ip_forward=1`，然后刷新配置 `sysctl -p /etc/sysctl.conf`。  
修改 iptables，注意对 iptables 做持久化。
{% codeblock lang:bash %}
# 若强化了服务器安全，需要开放 443 端口。
iptables -A INPUT -p tcp -m state --state NEW --dport 443 -j ACCEPT
iptables -A INPUT -p udp -m state --state NEW --dport 443 -j ACCEPT
iptables -D FORWARD -j DROP

# 打开 NAT
iptables -t nat -A POSTROUTING -j MASQUERADE
{% endcodeblock %}

### 测试 ocserv
修改 `ocserv.conf` 中的 `auth = "plain[passwd=/etc/ocserv/passwd]"`。  
创建用户 `ocpasswd -c /etc/ocserv/passwd your-username`。  
运行 ocserv `ocserv -f -d 1`，在手机上尝试连接。  

### 配置证书认证
修改 `/etc/ocserv/ocserv.conf` 中的以下项：  
{% codeblock lang:bash %}
auth = "certificate"
ca-cert = /etc/ocserv/certs/ca-cert.pem
{% endcodeblock %}
重新运行、测试连接。  


## 附录

### 以 service 运行 ocserv （Ubuntu）
执行以下指令
{% codeblock lang:bash %}
ln -s /lib/init/upstart-job /etc/init.d/ocserv

cat << _EOF_ > /etc/init/ocserv.conf
#!upstart
description "OpenConnect Server"

start on runlevel [2345]
stop on runlevel [06]

respawn
respawn limit 20 5

script
    exec start-stop-daemon --start --pidfile /var/run/ocserv.pid --exec /usr/local/sbin/ocserv -- -f >> /dev/null 2>&1
end script
_EOF_
{% endcodeblock %}
启动服务：`service ocserv start`  
停止服务：`service ocserv stop`  

### 方便的安装用户证书（iOS）
1. 将生成的用户证书 `USER.p12` 复制到 `WEBROOT`。
2. 打开 AnyConnect 客户端，切换到 Diagnostics 页。
3. 点击 Certificates 项，点击 Import User Certiticate...
4. 输入 `http://DOMAIN/USER.p12`，然后输入密码。


## 参考资料
* [Linux簡易配置Let's Encrypt證書及其在Anyconnect中的使用方法](https://touko.moe/blog/letsencrypt-ocserv-or-more)
* [折腾笔记：架设OpenConnect Server给iPhone提供更顺畅的网络生活](http://bitinn.net/11084/)
* [Ocserv在Debian下的安装与配置指南](https://github.com/blackgear/blog_article/blob/master/_posts/setup-debian-ocserv.md)

## 历史记录

20160215：Init  
20161018：使用 certbot（CentOS）  