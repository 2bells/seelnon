# Kangxi Mobile

![img](https://i.pinimg.com/736x/ae/fd/ce/aefdcee08c103f4e77ccf68785757c3b.jpg)

Ok, so I tested the whole CN radicals thing on mobile and it was a disaster. It should be more fixed right now. It could've been just the amount of Kangxi being loaded from all .json stuff: 810 and that caused a lot of slow down.

Mainly: just use filters 4head. But there is now a thing that caps amount of shown Kangxi and it should remember the shape of a character, so it doesn't go to a website to request a vector file...

So apparently vectors are not procedurally generated, but it is a community project: 
[Make me Hanzi](https://github.com/skishore/makemeahanzi)

Meaning my app won't fetch .svg if you are offline. Right now it should be cached, but... I didn't test it. In theory by having online connection at least once a making a request for .svg data, it will be kept on your end offline.

[Kangxi App](https://2bells.github.io/seelnon/Content/Projects/scripts/CN_Radicals_json/)

fix only on _json version. Will be sticking to it.

## Katex

Also updated Fri-ren notes and this blog to use 'katex' to do this: $E=mc^2$

For 'notes' it is local as well. While Blog is fetching the library online.

```
thought of a day

music is
a harmony extracted
from nature
```