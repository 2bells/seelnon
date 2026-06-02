# Iso Engine

![img c](https://i.pinimg.com/736x/cf/94/9e/cf949eff4789523a9beed749021d9777.jpg)

It is in a state of 'needs testing'. Meaning I don't have any big ideas to add and you can say it is 'feature complete' on some stand point.

[press to test](https://2bells.github.io/seelnon/Content/Projects/Iso_Engine/)

## Features
- prefabs
- custom sprites
- procedural dungeons
- projectile creator
- indexDB for saves
- .json import/export
- psychological AI
- light/shadow masks
- emitters/abilities
- quest creator
- npc creator
- events for logic
- item creator
- aram map

![img c](https://www.dropbox.com/scl/fi/0dn3mfrofa3sccstv8ccd/amount_of_enemies.jpg?rlkey=y3iarg92lphtw0syun50gy6f7&st=9kk25fg5&raw=1)

most of things are stored as an item, so it is fully OOP and modular to the point that an event is an item that has reference to event and item dictates the event. Abilities are also consider as item and could be equipped. Emitters are an item that could be equipped, making NPC as a turret or having passive shooting abilities (ex. Vampire Survivors). NPC could be used to create chests

![img c](https://www.dropbox.com/scl/fi/cuvqxyhknjr94ycimqkn5/portals_1.jpg?rlkey=f74h2sjwn1he9r3xjq2xxa43c&st=vvod4cl1&raw=1)

Leveling up of an item is bound to a dungeon that you can explore and after clearing the dungeon, item is increased in level.

![img c](https://www.dropbox.com/scl/fi/byxi4ycfsvbigndwk9c0f/portals_.jpg?rlkey=siuzw1j5fap7csbapn8tup0cm&st=q9yc94vn&raw=1)

Abilities are lootables and you can have a build featuring 5 same abilities if you want to.

![img c](https://www.dropbox.com/scl/fi/zr359g0ndatek89xkgaaq/iso_prefabs_.jpg?rlkey=gjo6xpzedzt7447d7immz7jj0&st=v7cxljsj&raw=1)

So even if something is not possible to do 'by hand' it is possible to make your templates, save as .json, upload the whole thing into AI and tell AI what you want to get. I do think that you can easily design a bunch of enemies, abilities and items on your own -> drop into AI and just say 'stitch it all together into Vampire Survivor' and you one shot a very nice game.

Also the portal test is to see ability to make an ARPG with it and it already has procedural generation. So it is possible to make you own rooms/dungeons using .json export of prefabs -> tell AI to stitch it together and you can have everything you need.

It is should be possible to make you own ideas even with editor only, but that needs a lot of test. Meaning I need to make a few things with it to even know if it is working or not. and because I was lazy and asked AI to do stuff: it has access to just code it in, instead of being concerned with 'in-editor' limitations.

So I can say for sure it is possible to make things AI assisted, but not sure if fully possible to just do it in UI.

![img c](https://www.dropbox.com/scl/fi/6ug6yms0i2e23c4oiyqjq/inventory1.jpg?rlkey=gwlgvsjg2qxx9srclbkkph6re&st=66ccudhr&raw=1)

Some fun things also include ability to view inventory of an NPC and ask for an item and that will start a quest line to give you that item instead of paying for it.

And it should be very possible to just make visual novels. 

Animations are not in, I was planning to do .gif and .png sprite sheet support, but it is already additional features for polish, because usually if it looks and feels playable with static sprites, it will be just better with animations. Then the effect maker which is also 'juice' ideas which are later if the engine makes sense to continue more.

I usually do those so when suddenly I have an inspiration to do something, I can just load my own engine up and start prototyping something that is VERY playable and serviceable as a game. Think of FF7 and FF7 Remake: this type of vibes. [Makes me think: I don't have turn based approach here, but should be easy to do. + turn based is better in RPG Maker, I feel like.]

```
thought of the day

brothers of night
give you cold feet
keep the warm
```