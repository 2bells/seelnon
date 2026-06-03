# Iso Engine

![img c](https://i.pinimg.com/736x/cf/94/9e/cf949eff4789523a9beed749021d9777.jpg)

It is in a state of 'needs testing'. Meaning I don't have any big ideas to add and you can say it is 'feature complete'.

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

Most of the logical things are stored as an in-game item, so it is fully OOP / modular to the point that even code of an event is an item. Abilities and even Emitters are also considered as equippable items and could be equipped on an NPC to make them like a turret or having passive shooting abilities (ex. Vampire Survivors). NPC creator could be used to create chests and doors, so you can have a full dialogue with a door, that has inventory and you can even make big romance story arc with it. So intractables / objects have 'NPC' code. You have option to design an event to simplify it to 'press to loot', without a need to summon a dialogue window. But I think it is fun to talk to a chair.

![img c](https://www.dropbox.com/scl/fi/cuvqxyhknjr94ycimqkn5/portals_1.jpg?rlkey=f74h2sjwn1he9r3xjq2xxa43c&st=vvod4cl1&raw=1)

Leveling up of an item is made by clearing a procedural dungeon that is 'bound' to an item. You summon a portal, go 'inside' that item and after clearing its inner dungeon, item is increased in level. (Disgaea had similar thing, for Iso Engine it is like maps in PoE endgame)

![img c](https://www.dropbox.com/scl/fi/byxi4ycfsvbigndwk9c0f/portals_.jpg?rlkey=siuzw1j5fap7csbapn8tup0cm&st=q9yc94vn&raw=1)

Abilities are lootables and you can equip 5 same abilities in every slot if you want to.

![img c](https://www.dropbox.com/scl/fi/zr359g0ndatek89xkgaaq/iso_prefabs_.jpg?rlkey=gjo6xpzedzt7447d7immz7jj0&st=v7cxljsj&raw=1)

Even if something is not possible to do 'by hand' it is possible to make your templates / prefabs, save it as .json, upload the whole thing into AI and tell AI what you want to do. 

I think that you can easily design a bunch of enemies, abilities and items on your own -> drop into AI and say: 'Mr. AI, please stitch it all together into Vampire Survivor style game' and you can one shot a very nice experience.

Also it should be possible to make ARPG. It already has procedural generation, so: make your own rooms / dungeons -> .json export of prefabs -> tell AI to stitch it together and you can have everything you need. (you do need to plan ahead, but I do think if you are going for... let's say Gemini 3.5, it should be fine. It is free as well on aistudio.google.com)

[google AI](https://aistudio.google.com/)

It should be possible to make your own ideas even with editor only, without any LLM, but that needs a lot of testing. Meaning, I need to make things with editor myself to know if it is working or not. But I was lazy and asked AI to do stuff and the main problem: it has access to the raw code itself, so it is not that concerned with 'in-editor' limitations.

So I can say for sure it is possible to make things LLM assisted, but not sure if it is possible to just do it using only 'in-game' editor UI.

![img c](https://www.dropbox.com/scl/fi/6ug6yms0i2e23c4oiyqjq/inventory1.jpg?rlkey=gwlgvsjg2qxx9srclbkkph6re&st=66ccudhr&raw=1)

Some fun things also include ability to view inventory of an NPC and ask for an item and that will start a quest line to give you that item instead of paying for it.

Visual novels should be easy to create without need for a code adjustment (as long as branches work, the rest should be able to setup with map teleports...). 

Animations are not in, I was planning to do .gif and .png sprite sheet support, but those are features for polish, because if it looks and feels playable with static sprites, it will be just better with animations. Effect maker is also 'juice' so it makes sense to not go ham on 'decorative' parts.

Main idea was to have a 'platform' for myself in case if I have a sudden burst of inspiration to start prototyping something that is VERY playable and serviceable as a game.

```
thought of the day

brothers of night
give you cold feet
keep them warm
```