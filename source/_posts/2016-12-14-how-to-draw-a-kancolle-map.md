---
title: How to Draw a KanColle Map
categories: kancolle
alias: /blog/2016/12/14/how-to-draw-a-kancolle-map/
---

This is a post about how [kcmap](https://github.com/yukixz/kcmap) draw a SVG using map SWF only.

{% asset_img kcmap_23_final.svg kcmap 2-3 final %}


## Basic Knowledge

In order to understand this post, you may need these knowledge.

### Display Container of Flash (AS3)

Flash (AS3) renders its display from a `DisplayObjectContainer` tree.
A container is isolated system, having self-governed coordinate system, child containers and so on.

These are common container: `MovieClip`, `Sprite`, `Shape`, etc.

### Coordinate System of Flash

Coordinate of flash allow interger only, while one point equals to 0.05 pixel.
It means `(8000, 6000)` is `(400, 300)` on screen.

### Decompilation of SWF

Usage of [JPEXS Free Flash Decompiler (ffdec)](https://www.free-decompiler.com/).


## Container

### Structure

According to the decompilation of map swf, a Sprite named `map` contains entire data inside the swf.

When game client calls `/api_req_map/start` or `/api_req_map/next`, the `api_no` value in response is used to indicates the route.
For example, `api_no: 11` indicates child Sprite `line11` of Sprite `map`.
If Sprite `line11` isn't a start spot, it will contain a Shape which contain the route Bitmap.

The container structure is as follows.
{% codeblock %}
Sprite@name=map
├─┬ child[@name=line11][@id=32] => Sprite@id=32
│ └─┬ child@id=31 => Shape@id=31
│   └─┬ shapeBounds
│     └ child@id=30 => Bitmap@id=30
├─┬ child[@name=line12][@id=34] => ...
│ └── ...
└ ...
{% endcodeblock %}

### Coordinate

As said, each container has its owned coordinate system.
The real coordinate of current container is got by summing up `x` and `y` from root to current container.

It's easy.
Let's mark line 11 of map 2-3 for an intuitive feeling.

* The GREEN cross is the origin of Sprite `line11` in its parent Sprite `map`.
* The CYAN cross is the origin of Shape (line11) in its parent Sprite `line11`.
* The RED rectangle is bounds of Shape (line11) which consists of Bitmap (line11).

{% asset_img kcmap_mc_23_11.png Map 2-3 line 11 %}


## Route

{% asset_img kcmap_mc_23.png Map 2-3 %}

Take a look at all container marked map 2-3.

It shows routes' end position, routes' image position, routes' image size, ...
Wait, where do routes start?
In fact, start position of routes don't appear inside SWF.
Guessing is required to find out routes' start position.

### Guess

Here's my method to guess start coordinate, using line 11 of map 2-3 as exmaple again.

1. Take all routes' end coordinate as map spots.
2. Calculate the coordinate of route image center(named C).
3. Draw a line from `line11` end spot (named E) to C stopped at S with twice length of EC.
4. The spot nearest S is start spot.

{% asset_img kcmap_23_11_guess_1.png Map 2-3 line 11 guess 1 %}
{% asset_img kcmap_23_11_guess_2.png Map 2-3 line 11 guess 2 %}
{% asset_img kcmap_23_11_guess_3.png Map 2-3 line 11 guess 3 %}
{% asset_img kcmap_23_11_guess_4.png Map 2-3 line 11 guess 4 %}

Then, we can draw the map image.

{% asset_img kcmap_23.svg kcmap 2-3 %}


## Spot Name

### Old Map

Spot is named as ABC letter by KanColle community to facilitate communication.
They're not offical map information, so aren't included in SWF.
Manual operation is required for assigning spot name.

### New Map

Since a time I don't know, KanColle production team begin to name spot as community did.
However, they embed the letters into the background, making it impossible to extract letters from SWF.
So, manual operation is also required.


## Draw

After the steps above, information for drawing a map is complete.

Let's take a look at the title image again.

{% asset_img kcmap_23_final.svg kcmap 2-3 final %}
