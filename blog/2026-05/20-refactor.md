# Y-Axis

![img](https://i.pinimg.com/736x/07/66/89/07668982366e604fcd8a8ad5581f224a.jpg)

Well, apparently, when you modify coordinates in MW, they are not being modified at all and still reference the root.
So my cute little plan of swapping different follow motion devices on runtime didn't work, because those need proper offset.

Refactor time!

![img](blog/2026-05/img/refactior_.jpg)

So right now it doesn't use follow motion at all, but 'by piece' which seems counter intuitive, because it loses the idea of basic composition, but MW in general kind of doesn't like that word to begin with.

A lot of performant 'code' is actually spiderweb central. [Makes sense on OOP and big structures, because every request becomes a giant task]

It still uses variables to reference collision of 'who is part of same piece' so it doesn't trigger self collision.

Line clear is also somewhat operational, but has some double triggers that I need to debug, but overall I can clear a line and pull the whole 'non-moving' structure down. I also track internal Y variable, because, again, no way of doing a query on it dynamically.

But it works... + new update came out, we will see how it goes.

![img](blog/2026-05/img/tetri-shot_MW_2.jpg)

```
thought of a day

everything will be fine,
universe is biased.
>_
table is tilted,
but in your favor.

///
[unless_]
[you are playing a boss character]
```
