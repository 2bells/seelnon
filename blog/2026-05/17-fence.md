# Fences

![image](https://i.pinimg.com/736x/11/db/4d/11db4d4589c5a1b53fe557a09de1431f.jpg)

Was doing some tetris stuff in MW... it is kinda painful. If pieces fall too fast they skip the collision check...

But I do have a 'per piece' fall instead of a global one, maybe global is a better solution... like gravity? But for some reason WM has hatered for coordinate manipulation and any 'update' function ever, even when I design my own.

It is like: "oh, so you think you can do a check every 0.03 seconds... no you don't, the number is a lie: collision/speed checks happen only at 0.3 anyway" [overall I found out that 0.24 is + - the limit, so it is actually ~4 tick rate]

![image](blog/2026-05/img/tetri-shot_MW.jpg)

Pieces are 'shoot-able', so fun interactability is here... thinking about making my 'tetri-shot' but in MW + some features. Kind of puzzled by 'hover' ghost projection to show a player where a piece will spawn. I have a very bootleg idea, but it should work. It is based on ancient computer technique around 2 specific keys 'c' and 'v'.

```
thought of a day:

some walls
are not climbable 
by design.
```