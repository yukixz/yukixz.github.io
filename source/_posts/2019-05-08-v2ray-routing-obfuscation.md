---
title: 'V2Ray 路由配置与混淆配置'
date: 2019-05-08 11:50:05
tags: [ V2Ray, TLS, WebSocket, Configuration ]
---


## 起因

Shadowsocks 是一个纯粹的代理服务，需要前置 PAC 才能实现请求路由的功能。然而支持 PAC 代理规则的应用程序是稀少的，实际使用中都有发现不少应用程序无法理解系统配置里的PAC规则，只能在应用程序里配置成所有请求都走代理服务。
{% asset_img ss+pac.svg Shadowsocks with PAC %}

V2Ray 则提供了代理服务级别的请求路由功能。应用程序可以无脑地将所有请求都发送到本地代理，由本地代理对请求进行路由，选择直连或者发送到不同代理服务器。这种方式可以兼容所有支持配置HTTP/Socks代理的应用程序，优势很大（A 了上去）。
{% asset_img v2ray-routing.svg V2Ray use routing %}


## 路由配置

我习惯上只有国内流量走直连，其他流量全部走代理加速访问，所以采用以下请求路由规则：
1. 常见国内域名直接直连，提高路由选择效率。
2. 常用代理域名直接代理，提高路由选择效率。被DNS污染的域名在这里处理。
3. 进行DNS解析（IPOnDemand），如果是国内IP则直连。CDN在这里解析到国内节点。
4. 其它请求全部都走代理。

{% asset_img routing-rules.svg %}

在使用 Shadowsocks 的时候，我编写了 [whitepac](https://github.com/yukixz/whitepac) 自动生成满足上述路由规则的 PAC 文件。而 V2Ray 客户端里已经维护了一系列的域名和IP清单，因此路由规则可以简化许多。最终 `routing` 配置如下，需要 [`geosite.dat 3d506a8`](https://github.com/v2ray/domain-list-community)。

{% codeblock lang:json V2Ray routing %}
{
    "name": "ROUTING",
    "domainStrategy": "IPOnDemand",
    "rules": [
        {
            "type": "field",
            "outboundTag": "DIRECT",
            "domain": [
                "geosite:cn",
                "geosite:apple",
                "domain:steampowered.com"
            ]
        },
        {
            "type": "field",
            "outboundTag": "PROXY",
            "domain": [
                "geosite:geolocation-!cn",
                "domain:tw"
            ]
        },
        {
            "type": "field",
            "outboundTag": "DIRECT",
            "ip": [
                "geoip:private",
                "geoip:cn"
            ]
        },
        {
            "type": "field",
            "outboundTag": "PROXY",
            "port": "0-65535"
        }
    ]
}
{% endcodeblock %}


## 流量混淆（TLS+Websocket）

近期传言某工程上线了基于加密流量特征分析的代理探测方案，实际体验中单纯的加密代理确实会有不时的中断，无法稳定使用。解决方案有两种：一为不使用固定服务器和端口，随机切换从而减少单一服务的流量，减少探测的流量样本；二为伪装成正常协议流量，增加流量探测的难度，从而减少被探测出来的可能性。两种方案各有优劣，这里不做详细分析。

由于 V2Ray 支持使用 TLS 和 WebSocket 作为 vmess 代理协议的传输层，我们使用 nginx 提供 `wss://v2ray` 实现 TLS，然后由 V2Ray 自行处理 `ws://v2ray`。细节如下：
1. nginx 作为唯一流量的入口，配置为对外提供正常的 HTTP(s) 服务，需要的话也可以部署一个普通的网站。
2. 同时，nginx 对外提供 `wss://v2ray`，并将 wss 解开 TLS 后转发到 v2ray-server。
3. v2ray-server 接受 `ws://v2ray` 请求，通过 vmess 协议和 v2ray-client 交互实现代理服务。
4. v2ray-client 配置为使用 TLS+WebSocket 传输层协议。
5. v2ray-client 开启 [Mux 多路复用](https://www.v2ray.com/chapter_02/mux.html)，减少多层封包导致的 RTT 问题影响。

流量如下图，一层一层封包：
{% asset_img v2ray-transmit.svg V2Ray transmit %}

请求由 nginx 进行转发：
{% asset_img v2ray-server.svg V2Ray server %}


## 代理配置

nginx 提供 WebSocket over TLS (wss)：
{% codeblock lang:text nginx server %}
server {
    listen            443 ssl http2 fastopen=4 reuseport;
    listen       [::]:443 ssl http2 fastopen=4 reuseport;
    server_name  yourdomain.org;

    ssl on;
    ssl_certificate     /etc/letsencrypt/live/yourdomain.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.org/privkey.pem;

    location /v2ray {
        proxy_pass          http://127.0.0.1:10000;
        proxy_redirect      off;
        proxy_http_version  1.1;
        proxy_set_header    Connection "upgrade";
        proxy_set_header    Upgrade $http_upgrade;
        proxy_set_header    Host $host;
        proxy_set_header    X-Real-IP $remote_addr;
        proxy_set_header    X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
{% endcodeblock %}

v2ray-server 提供 VMess over WebSocket：
{% codeblock lang:json v2ray-server inbounds %}
{
  "port": 10000,
  "listen": "127.0.0.1",
  "protocol": "vmess",
  "settings": {
    "clients": [
      {"id": "88888888-4444-4444-4444-cccccccccccc", "alterId": 64}
    ]
  },
  "streamSettings": {
    "network": "ws",
    "wsSettings": {"path": "/v2ray"}
  }
}
{% endcodeblock %}

v2ray-client 使用 VMess over WebSocket over TLS 连接代理服务器，并开启 Mux 多路复用：
{% codeblock lang:json v2ray-client outbounds %}
{
  "tag": "PROXY",
  "protocol": "vmess",
  "settings": {
    "vnext": [
      {
        "address": "yourdomain.org",
        "users": [{
          "id": "88888888-4444-4444-4444-cccccccccccc",
          "alterId": 64,
          "security": "auto",
          "level": 0
        }]
      }
    ]
  },
  "streamSettings": {
    "network": "ws",
    "security": "tls",
    "wsSettings": {"headers": {}, "path": "/v2ray"},
    "tlsSettings": {
      "serverName": "yourdomain.org",
      "alpn": ["http/1.1"],
      "allowInsecure": false,
      "allowInsecureCiphers": false
    }
  },
  "mux": {"enabled": true, "concurrency": 8}
}
{% endcodeblock %}
