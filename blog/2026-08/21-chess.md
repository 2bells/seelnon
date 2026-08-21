# Chessing

![img](blog/2026-08/img/chess_mate.jpg)

I poked chess.com with a stick and they want me to spend money to ask computer for help.

So I found Stockfish is an open package and made it so you don't have to pay for an open package functions.
Of course it is not that great: without voice lines and telling you cool stuff, but you can extrapolate.

## Search

It does 12 depth search on 4 lines on every move. So when it says: 

> That's a bad move...

It might seen some futures when in 12 moves you will be in trouble on all 4 timelines.

## Strength

Stockfish is too strong for a pleb like me, its lowest is '2nd best moves at 1320 elo'... So yeah, at its lowest it plays 100% all the time, just not the most perfect 100%.

Meaning: for elo lower than 1320 it uses another package of js-chess-engine that is a bit wild, but fits into the lower elo. It surprisingly 'weird' in a good way, was a good find. 

[GitHub Link](https://github.com/josefjadrny/js-chess-engine/tree/master)

//I was actually a bit perplexed as why 1000 elo is THAT good and at first I was thinking if chess.com is a fraud with their rating, or the worst play of best engine is just too good. 2nd is the answer.

## Play

Iframe should work, right? blog probably has no enough space for it, oh well.
If you want to play 'best chess engine', then slider to 1320+

<iframe 
  src="https://2bells.github.io/seelnon/Content/Projects/Chess/index.html" 
  title="Tetris"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin"
  referrerpolicy="no-referrer-when-downgrade"
  style="border: none; width: 97%; height: 800px;">
</iframe>

Anyway click is clickable here:

[Play Chess](https://2bells.github.io/seelnon/Content/Projects/Chess/)


```
thought of a day

simple water
is always
a better option
```