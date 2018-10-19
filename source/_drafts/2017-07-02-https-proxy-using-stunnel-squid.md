---
layout: post
title: "HTTPS Proxy Using Stunnel & Squid"
date: 2017-07-20 20:00:00 +0800
comments: true
categories: 
---


# Environment

* OS: CentOS 7.2
* Repo: epel, ius


# Topology

```
+--- User ---+         +------ Proxy ------+      +-- Server --+
|            |         |                   |      |            |
|   Browser  === TLS === Stunnel === Squid ========    Web     |
|            |         |                   |      |            |
+------------+         +-------------------+      +------------+
```

Stunnel is uesd to establish a secure TLS tunnel between browser and proxy.
Squid is used to provide HTTP proxy for accessing web.


# Squid

Squid is a caching proxy for the Web supporting HTTP, HTTPS, FTP, and more.

